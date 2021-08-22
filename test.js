const nanaParser = require('./index.js')
const {nanaEval, nanaEvaluator} = require('./evaluator.js')
const fs = require('fs')

/*
    blk = (
        x := 1;
        y := 2;
        max := |x, y| (
            x - y
        );
        1
    );
    <x; y> = blk;
    blk.max blk.x blk.y
    [[1, d], (e, 4)] = [[1, 2], (3, 4)];
    d, e

*/

const script = `
    c = (
        a = 1;
        (
            a - 2
        )
    );
    c + 2, c + 3
`

function save(result) {
    fs.writeFileSync('ast.json', JSON.stringify(result, null, 4))
}

try {
    const result = nanaParser(script, save)
    save(result)
    const v = nanaEval(result)
    console.log('evaluate finish, start calculate')
    console.log(nanaEvaluator(v))
} catch (e) {
    console.log(e)
}
