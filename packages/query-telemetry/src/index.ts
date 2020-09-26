#! /usr/bin/env node

import yargs from 'yargs';
import parse from 'csv-parse'
import fs from 'fs';
import CliTable3 from 'cli-table3';
import _ from 'lodash';

const {argv} = yargs
  .options({
    file: {
      alias: 'f',
      required: true,
      type: 'string',
      description: 'The telemetry CSV file' 
    },
  })
  .help();

const parser = parse({
  relaxColumnCount: true
});

// let mainThreadId: string;

type Timespan = {
  name: string;
  startTimeNs: number;
  endTimeNs: number;
}

const timespans: Timespan[] = [];

function handleRow(row: string[]): void {
  const [rowName] = row;
  // if (rowName === 'TM_TRACK' && row[2] === 'Main Thread') {
  //   mainThreadId = row[1];
  //   return;
  // }
  if (rowName === 'TM_TIMESPAN') {
    timespans.push({
      name: row[2],
      startTimeNs: parseInt(row[3]),
      endTimeNs: parseInt(row[4]),
    })
  }
}

parser.on('readable', () => {
  let record;
  while (record = parser.read()) {
    handleRow(record);
  }
})

parser.on('end', () => {
  const table = new CliTable3({
    head: ['Order', 'Duration (nanoseconds)', 'Count of Queried Method Calls']
  });

  _(timespans)
    .sortBy('startTime')
    .forEach((timespan, index) => {
      table.push([index, timespan.endTimeNs - timespan.startTimeNs]);
    });

  console.log(table.toString());
})


// parser.on('data', (chunk) => {
//   console.log('chunk', chunk.toString());
// })

fs.createReadStream(argv.file).pipe(parser);