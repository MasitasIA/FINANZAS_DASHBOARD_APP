module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      [
        "module-resolver",
        {
          root: ["."],
          alias: {
            "@": "./src",
          },
          extensions: [".ios.js", ".android.js", ".web.js", ".js", ".ts", ".tsx", ".web.ts", ".web.tsx", ".json"],
        },
      ],
    ],
  };
};
