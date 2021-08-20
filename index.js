const nearley = require('nearley')
const grammar = require('./nanane.js')

module.exports = function nanaParser(input, f = null) {
    const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar))
    parser.feed(input)
    if (parser.results.length === 0) {
        throw 'no parse result found'
    }
    if (parser.results.length > 1) {
        if (f)
            f(parser.results)
        throw `ambiguity detected, found ${parser.results.length} results`
    }
    return parser.results[0]
}
