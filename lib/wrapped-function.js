const util = require("util");

// This class wraps a function with an `util.inspect.custom` method, so that
// it is outputted in a specific format when `util.inspect()` is used, either
// on it directly or on any object that contains it.
class WrappedFunction {
  constructor(fn) {
    this.fn = fn;
  }

  [util.inspect.custom](_, { indentationLvl }) {
    const fnSource = this.fn.toString();
    const indentedSource = fnSource
      .split("\n")
      .map((line, index, lines) => {
        // Oddly, the `toString` method adds a line break after the last
        // parameter in the function signature. We get rid of it here.
        if (index === 0) return line + (lines[1] || "");
        if (index === 1) return null;

        const isLastLine = index === lines.length - 1;

        return " ".repeat(indentationLvl + (isLastLine ? 0 : 2)) + line;
      })
      .filter(Boolean)
      .join("\n");

    return indentedSource;
  }
}

module.exports = WrappedFunction;
