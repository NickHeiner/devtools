#! /usr/bin/env node

// Console logging is fine for a CLI tool.
/* eslint-disable no-console */

import yargs from 'yargs';
import parse from 'csv-parse';
import fs from 'fs';
import CliTable3 from 'cli-table3';
import _ from 'lodash';
import prettyError from 'pretty-error';
import 'loud-rejection/register';
import createLog from 'nth-log';

prettyError.start();

const log = createLog({name: 'query-telemetry'});

const {argv} = yargs
  .options({
    file: {
      alias: 'f',
      required: true,
      type: 'string',
      description: 'The telemetry CSV file' 
    },
    methodNameRegex: {
      alias: 'r',
      default: '^render$',
      type: 'string',
      description: 'A regex that selects the methods whose calls you want to track'
    }
  })
  .help();

const methodNameRegex = new RegExp(argv.methodNameRegex);

const parser = parse({
  relaxColumnCount: true
});

let mainThreadId: string;

type Timeable = {
  startTimeNs: number;
  endTimeNs: number;
}

type Timespan = Timeable & {
  name: string;
}

const timespans: Timespan[] = [];

// For now, this type is actually the same.
//
// Some method calls will not appear in any timespan.
const methodCalls: Timespan[] = [];

const throwParseError = (message: string, lineNumber: number) => {
  const err = new Error(`Parse error on 0-indexed line number "${lineNumber}": ${message}`);
  Object.assign(err, {lineNumber});
  throw err;
}

function handleRow(row: string[], rowIndex: number): void {
  const [rowName] = row;
  if (rowName === 'TM_TRACK' && row[2] === 'Main Thread') {
    mainThreadId = row[1];
    log.debug({mainThreadId}, 'Found main thread');
    return;
  }
  if (rowName === 'TM_TICK' && mainThreadId === undefined) {
    throwParseError(
      'This tool expected to find a "Main Thread" TM_TRACK before seeing the first TM_TICK, but did not.',
      rowIndex
    );
  }
  if (rowName === 'TM_TIMESPAN') {
    timespans.push({
      name: row[2],
      // This will drop the last few digits of a nanosecond number, but I think that's ok.
      startTimeNs: parseInt(row[3]),
      endTimeNs: parseInt(row[4])
    });
    return;
  }
  if (rowName === 'TM_ZONE' && row[1] === mainThreadId && row[2].includes('http')) {
    const methodNameMatch = /^(.+?)(?=::)/.exec(row[2]);
    if (!methodNameMatch) {
      throwParseError(`This tool could not parse the following TM_ZONE line: "${row}"`, rowIndex);
      // This return is redundant with the throw above, but otherwise TS won't consider methodNameMatch to be proven
      // to be non-null.
      return;
    }
    const methodName = methodNameMatch[1];
    const methodStartTimeNs = parseInt(row[3]);
    const methodEndTimeNs = parseInt(row[4]);
    methodCalls.push({startTimeNs: methodStartTimeNs, endTimeNs: methodEndTimeNs, name: methodName});
  }
}

let rowsSeen = 0;
const rowLogInterval = 100000;
parser.on('readable', () => {
  let record;
  while (record = parser.read()) {
    handleRow(record, rowsSeen);
    rowsSeen++;
    if (!(rowsSeen % rowLogInterval)) {
      log.debug({rowsSeen}, 'Processing rows');
    }
  }
});

const getMethodCallsForTimespan = (timespan: Timespan) => methodCalls
  .filter(({startTimeNs, endTimeNs}) => 
    _.inRange(startTimeNs, timespan.startTimeNs, timespan.endTimeNs) && 
    _.inRange(endTimeNs, timespan.startTimeNs, timespan.endTimeNs)
  )

const nanosecondsInMilliseconds = 1e6;
const durationPrecision = 3;

parser.on('end', () => {
  const nonMatchingCalls = _(methodCalls).reject(({name}) => methodNameRegex.test(name)).map('name').value();
  const otherRenderCalls = _(methodCalls).filter(({name}) => name.includes('render')).map('name').value();

  log.trace({
    timespans, 
    // nonMatchingCalls
    otherRenderCallsLen: otherRenderCalls.length,
    otherRenderCalls,
    nonMatchingCallsLen: nonMatchingCalls.length
  });
  log.trace({methodCalls});

  const table = new CliTable3({
    head: [
      'Order', 'Name', 'Start Time (ns)', 'Duration (ms)', 'Count of all method calls', 
      'Count of Queried Method Calls'
    ]
  });

  _(timespans)
    .sortBy('startTimeNs')
    .forEach((timespan, index) => {
      const methodCalls = getMethodCallsForTimespan(timespan);

      table.push([
        index, 
        timespan.name,
        timespan.startTimeNs,
        ((timespan.endTimeNs - timespan.startTimeNs) / nanosecondsInMilliseconds).toPrecision(durationPrecision), 
        methodCalls.length,
        methodCalls.filter(({name}) => methodNameRegex.test(name)).length
      ]);
    });

  console.log(table.toString());
});

fs.createReadStream(argv.file).pipe(parser);