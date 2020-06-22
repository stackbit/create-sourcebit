const util = require('util');

Function.prototype[util.inspect.custom] = function(_, { indentationLvl }) {
    const fnSource = this.toString();
    const indentedSource = fnSource
        .split('\n')
        .map((line, index, lines) => {
            // Oddly, the `toString` method adds a line break after the last
            // parameter in the function signature. We get rid of it here.
            if (index === 0) {
                return (line + (lines[1] || '')).replace('function anonymous', 'function');
            }

            if (index === 1) return null;

            const isLastLine = index === lines.length - 1;

            return ' '.repeat(indentationLvl + (isLastLine ? 0 : 2)) + line;
        })
        .filter(Boolean)
        .join('\n');

    return indentedSource;
};

class WrappedFunction {
    constructor(fn) {
        this.fn = fn;
    }

    [util.inspect.custom]() {
        return this.fn.toString();
    }
}

module.exports = WrappedFunction;
