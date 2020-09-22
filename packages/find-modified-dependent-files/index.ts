#! /usr/bin/env node

import yargs from 'yargs';
import dependencyTree from 'dependency-tree';
import 'loud-rejection/register';
import execa from 'execa';
import _ from 'lodash';

const {argv} = yargs
  .options({
    compareRef: {
      type: 'string',
      default: 'HEAD',
      description: 'The changed ref to compare with.'
    },
    mainRef: {
      type: 'string',
      default: 'origin/master',
      description: 'The upstream branch to compare with.'
    },
    file: {
      required: true,
      type: 'string',
      description: 'The file whose dependents you are investigating' 
    },
    allFiles: {
      required: true,
      type: 'string',
      description: 'The directory that contains all the files you could possibly be looking for' 
    }
  })
  .help();

async function main() {
  const dependentFiles = dependencyTree.toList({
    filename: argv.file,
    directory: argv.allFiles
  });

  const mergeBase = await execa('git', ['merge-base', argv.compareRef, argv.mainRef]);
  const changedFiles = await execa('git', ['diff', `${mergeBase}..${argv.compareRef}`]);

  console.log(_.intersection(dependentFiles, changedFiles));
}

main();

