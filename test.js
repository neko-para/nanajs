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

        c = |x| (x + y);
        d y = c;
        a = |(x, y)| c;
        a (1, 2) 3, d 2 4
*/

const script = `
    [
        c = |x| (e:=x; x + y);
        d y = c;
        a = |(x, y)| c;
        a (1, 2) 3, d 2 4
    ]
`

function save(result) {
    fs.writeFileSync('ast.json', JSON.stringify(result, null, 4))
}

try {
    const result = nanaParser(script, save)
    save(result)
    const v = nanaEval(result)
    console.log(nanaEvaluator(v))
} catch (e) {
    console.log('error:', e)
}
