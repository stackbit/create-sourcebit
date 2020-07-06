const util = require('util');

Function.prototype[util.inspect.custom] = function (_, { indentationLvl }) {
    const fnSource = this.toString();
    const indentedSource = fnSource
        .split('\n')
        .map((line, index) => {
            if (index === 0) {
                return line.replace('function anonymous', 'function');
            }

            return line;
        })
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
