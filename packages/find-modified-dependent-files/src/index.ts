#! /usr/bin/env node

import yargs from 'yargs';
import dependencyTree from 'dependency-tree';
import 'loud-rejection/register';
import execa from 'execa';
import _ from 'lodash';
import path from 'path';

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
  const absolutePathependentFiles = dependencyTree.toList({
    filename: argv.file,
    directory: argv.allFiles
  });
  const gitRoot = (await execa('git', ['rev-parse', '--show-toplevel'])).stdout;
  const dependentFiles = absolutePathependentFiles.map(filePath => path.relative(gitRoot, filePath));

  const mergeBase = (await execa('git', ['merge-base', argv.compareRef, argv.mainRef])).stdout;
  const changedFiles = (await execa('git', ['diff', '--name-only', `${mergeBase}..${argv.compareRef}`]))
    .stdout.split('\n');

  const changedDependentFiles = _.intersection(dependentFiles, changedFiles);
  changedDependentFiles.forEach(filePath => console.log(filePath));
}

main();

