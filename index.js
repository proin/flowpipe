exports = module.exports = (function () {
    var obj = {};
    var flow = {};
    var action = {};
    var next_id = [];
    var proc = 0;
    var loopback_instance = {};
    var opts = {};

    var manager = function (args) {
        if (args[0]) {
            action.end(args[0]);
            return;
        }

        var next = next_id[proc];
        proc++;

        if (!next) {
            var exec = 'action.end(null';
            for (var i = 1; i < args.length; i++)
                exec += ',args[' + i + ']'
            exec += ')';
            eval(exec);
            return;
        }

        var args_pipe = [];
        for (var i = 1; i < args.length; i++)
            args_pipe.push(args[i]);

        var type = next.split('-')[0];
        action[type](next, args_pipe);
    };

    obj.init = function (_opts, work) {
        if (work) {
            action.init = work;
            opts = _opts;
        } else {
            action.init = _opts;
        }

        return obj;
    };

    obj.pipe = function (name, work) {
        next_id.push('pipe-' + name);
        flow['pipe-' + name] = work;
        return obj;
    };

    obj.parallel = function (name, work) {
        next_id.push('parallel-' + name);
        flow['parallel-' + name] = work;
        return obj;
    };

    obj.loopback = function (type, name, work) {
        next_id.push('loopback-' + type + '-' + name);
        flow['loopback-' + type + '-' + name] = work;
        return obj;
    };

    obj.end = function (work) {
        action.end = work ? work : function () {
        };
        action.init(function () {
            manager(arguments);
        });
    };

    action.pipe = function (next, args) {
        var work = flow[next];

        var manage = function () {
            manager(arguments);
        };

        var exec = 'work(manage';
        for (var i = 0; i < args.length; i++)
            exec += ',args[' + i + ']'
        exec += ')';
        eval(exec);
    };

    action.parallel = function (next, args) {
        var work = flow[next];

        if (typeof args[0] != 'object') {
            var err = new Error("Parameter Type Error!");
            err.msg = 'parameter allow only array';
            action.end(err);
            return;
        }

        var manage = function () {
            if (status.length == args[0].length) {
                for (var i = 0; i < status.length; i++)
                    if (!status[i])
                        return;

                for (var i = 0; i < err.length; i++)
                    if (err[i])
                        return action.end(err[i]);

                var hasResult = false;
                for (var i = 0; i < result.length; i++)
                    if (result[i])
                        hasResult = true;

                console.log(hasResult);
                if (hasResult) {
                    args[0] = result;
                    args.unshift(null);
                } else {
                    args[0] = null;
                }
                manager(args);
            }
        };

        var result = [];
        var status = [];
        var err = [];

        var parallel_fn = function (parallel_obj) {
            return function () {
                err[parallel_obj] = arguments[0];
                result[parallel_obj] = arguments[1];
                status[parallel_obj] = true;
                manage();
            }
        };

        try {
            for (var i = 0; i < args[0].length; i++) {
                var exec = 'work(parallel_fn(' + i + '),args[0][i]';
                for (var j = 1; j < args.length; j++)
                    exec += ',args[' + j + ']'
                exec += ')';
                eval(exec);
            }
        } catch (e) {
        }
    };

    action.loopback = function (next, args) {
        var work = flow[next];
        var loopback_target = next.substring(9);
        if (!loopback_instance[next]) loopback_instance[next] = {};

        var loop = function () {
            for (var i = 0; i < next_id.length; i++)
                if (next_id[i] == loopback_target)
                    proc = i;
            manager(arguments);
        };

        var next_fn = function () {
            manager(arguments);
            delete loopback_instance[next];
        };

        var exec = 'work(loop,next_fn,loopback_instance[next]';
        for (var i = 0; i < args.length; i++)
            exec += ',args[' + i + ']'
        exec += ')';
        eval(exec);
    };

    return obj;
})();