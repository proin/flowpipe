`flowpipe` is installable via:

- npm: `npm install flowpipe`

## Quick Start

```javascript
var flowpipe = require('flowpipe');

flowpipe
    .init(function (next) {
        // init before start
        var page = 1;
        next(null, page);
    })
    .pipe('start', function (next, page) {
        // page is that previous next function's variable
        setTimeout(function (err) {
            // next is function that proceed next pipe, parallel or loopback
            next(err, page);
        }, 1000);
    })
    .pipe('list', function (next, page) {
        console.log('start page: ' + page);
        // preparing list for parallel
        var list = [{no: 1}, {no: 2}, {no: 3}];
        for (var i = 0; i < list.length; i++) {
            list[i].page = page;
            list[i].delay = 3 - i; // delay time in parallel process
        }
        // next before parallel, pass only second parameter to parallel process.
        // second parameter must be array.
        // other parameters pass to next pipe or loopback.
        next(null, list, page);
    })
    .parallel('parallel process', function (next, data) {
        // data is indicating each of list items.
        setTimeout(function () {
            data.title = 'title-' + data.no;
            next(null, data);
        }, data.delay * 1000);
    })
    .jump('page-classify', function (next, parallel, page) {
        // jump(name, fn)
        // - name: jump fn name
        // - fn(next, args)
        //   - next(jump_to, args)
        //     - jump_to: process_type-process_name
        if (page == 1)
            next('pipe-pass-1', parallel, page);
        else
            next('pipe-pass-else', parallel, page);
    })
    .pipe('pass-1', function (next, parallel, page) {
        console.log('pass-1');
        next(null, parallel, page);
    })
    .pipe('pass-else', function (next, parallel, page) {
        console.log('pass-else');
        next(null, parallel, page);
    })
    .loopback('pipe-list', function (loop, next, instance, parallel, page) {
        // loopback(process_type-process_name, fn)
        // - process_type: pipe, parallel
        // - process_name: must defined
        // - fn(loop, next, instance, others...)
        //   - loop(err, variables...): passing variable to target process
        //   - next(err, variables...): proceeding if loop ended
        //   - instance: maintainable variable in loop, object type {}
        //   - others: passed from before process
        if (!instance.data) instance.data = [];
        for (var i = 0; i < parallel.length; i++)
            instance.data.push(parallel[i]);
        if (page < 5) loop(null, page + 1);
        else next(null, instance.data);
    })
    .pipe('finalize', function (next, data) {
        next(null, data);
    })
    .end(function (err, data) {
        // end(callback) or end()
        // this must be declared, if not all function don't working.
        // proceed in the end or occured error in process
    });
```
