// Jest transform that mirrors webpack's `asset/source` for .html imports
// (react-fleet's boston.gov header/footer/navigation chrome).
module.exports = {
  process(sourceText) {
    return {
      code: `module.exports = ${JSON.stringify(sourceText)};`,
    };
  },
};
