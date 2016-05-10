var flowpipe = require('../index');
flowpipe
    .init(function (next) {
        var size = 2000000000;
        next(null, size);
    })
    .pipe('parallel single thread', function (next, size) {
        var item = [1, 2, 3, 4, 5, 6, 7, 8];
        var st = new Date().getTime();
        next(null, item, st, size);
    })
    .parallel('single thread', function (next, item, st, size) {
        for (var i = 0; i < size; i++)
            ;
        next();
    })
    .pipe('parallel multi thread', function (next, parallelData, st, size) {
        console.log('single thread total(ms)', new Date().getTime() - st);
        var item = [1, 2, 3, 4, 5, 6, 7, 8];
        st = new Date().getTime();
        next(null, item, st, size);
    })
    .parallel('multi thread', function (next, item, st, size) {
        for (var i = 0; i < size; i++)
            ;
        next();
    }, {multiThread: true})
    .pipe('finalize', function (next, data, st) {
        console.log('multi thread total(ms)', new Date().getTime() - st);
        next();
    })
    .end(function (err) {
    })
    .graph('./graph/multi-thread.html');