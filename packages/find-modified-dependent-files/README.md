# find-modified-dependent-files

Imagine you have a long-running feature branch in a complicated JS project. You'd like to know: "given an input file, what are all its dependent files that's different between my feature branch and main?" This tool answers that question.

```
$ find-modified-dependent-files --file src/routes/my-route.js --allFiles src
src/routes/my-route-helper.js
src/components/comp-a.js
src/components/comp-b.js
```

In this case, `comp-a.js`, `comp-b.js`, and `my-route-helper.js` are reachable from `my-route.js` via `require` or `import`, and they've changed between the feature branch and upstream.

The dependency tree will likely change between branches, so if you're wondering why something is different on the feature branch, you'll want to be on the feature branch when you run this command.

Run `--help` for more detailed usage instructions.