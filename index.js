exports = module.exports = (function () {
    var flowpipe = function () {
        function getParamNames(func, sidx) {
            if (!sidx) sidx = 1;

            try {
                var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
                var ARGUMENT_NAMES = /([^\s,]+)/g;
                var fnStr = func.toString().replace(STRIP_COMMENTS, '');
                var result = fnStr.slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')')).match(ARGUMENT_NAMES);

                var returnVal = '';
                if (result != null)
                    for (var i = sidx; i < result.length; i++)
                        returnVal += result[i] + ', '
                returnVal = returnVal.substring(0, returnVal.length - 2);
                return returnVal;
            } catch (e) {
                return '';
            }
        }

        var obj = {};
        var flow = {};
        var flowParams = {};
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
                flowParams['init'] = getParamNames(work);
                action.init = work;
                opts = _opts;
            } else {
                action.init = _opts;
                flowParams['init'] = getParamNames(_opts);
            }

            return obj;
        };

        obj.pipe = function (name, work) {
            next_id.push('pipe-' + name);
            flow['pipe-' + name] = work;
            flowParams['pipe-' + name] = getParamNames(work);
            return obj;
        };

        obj.parallel = function (name, work) {
            next_id.push('parallel-' + name);
            flow['parallel-' + name] = work;
            flowParams['parallel-' + name] = getParamNames(work);
            return obj;
        };

        obj.loopback = function (name, work) {
            next_id.push('loopback-' + name);
            flow['loopback-' + name] = work;
            flowParams['loopback-' + name] = getParamNames(work, 3);
            return obj;
        };

        obj.jump = function (name, work) {
            next_id.push('jump-' + name);
            flow['jump-' + name] = work;
            flowParams['jump-' + name] = getParamNames(work);
            return obj;
        };

        obj.end = function (work) {
            action.end = work ? work : function () {
            };
            flowParams['end'] = getParamNames(work);
            action.init(function () {
                manager(arguments);
            });
            return obj;
        };

        obj.graph = function (save_path) {
            var idx = 0;
            var nodes = [];
            var edges = [];
            var typeColor = {parallel: '#0277bd', pipe: '#039be5', jump: '#00acc1', loopback: '#f57c00'};
            var arrows = {to: {enabled: true, scaleFactor: 1}};

            var nodeCreate = function (id, label, color) {
                var lb = label.length > 8 ? label.substring(0, 6) + '...' : label;
                return {id: id, label: lb, title: label, shape: 'box', font: {color: '#fff'}, color: color}
            };

            nodes.push(nodeCreate('init', 'init', '#7cb342'));
            var nodeidx = 0;
            for (var i = 0; i < next_id.length; i++, nodeidx++) {
                var current = next_id[i];
                var type = current.split('-')[0];
                var name = current.substring(type.length + 1);
                var pre = nodes[nodeidx];
                var currentParam = flowParams[current];

                if (type == 'loopback') {
                    nodes.push(nodeCreate(current, 'loopback', typeColor[type]));
                    var jumpParam = flowParams[name];
                    edges.push({
                        from: current,
                        to: name,
                        arrows: arrows,
                        label: jumpParam,
                        color: '#039be5'
                    });

                    edges.push({
                        from: pre.id,
                        to: current,
                        arrows: arrows,
                        label: currentParam
                    });
                } else if (type == 'parallel') {
                    if (pre.id.split('-')[0] == 'parallel') {
                        pre = nodes.splice(nodeidx, 1)[0];
                        nodeidx--;
                    }

                    for (var j = 0; j < 2; j++) {
                        var insertnode = nodeCreate(j + '-' + current, name, typeColor[type]);
                        nodes.push(insertnode);
                        var from = pre.id;
                        if (pre.id.split('-')[0] == 'parallel')
                            from = j + '-' + from;
                        edges.push({
                            from: from,
                            to: j + '-' + current,
                            arrows: arrows,
                            label: currentParam
                        });
                        edges.push({from: j + '-' + current, to: current, arrows: arrows});
                        nodeidx++;
                    }
                    nodes.push(nodeCreate(current, 'Sync', typeColor[type]));
                } else {
                    nodes.push(nodeCreate(current, name, typeColor[type]));
                    edges.push({
                        from: pre.id,
                        to: current,
                        arrows: arrows,
                        label: currentParam
                    });
                }
            }
            nodes.push(nodeCreate('end', 'end', '#f57c00'));
            edges.push({
                from: next_id[next_id.length - 1],
                to: 'end',
                arrows: arrows,
                label: flowParams['end']
            });

            if (save_path) {
                var fs = require('fs');
                var html = fs.readFileSync(__dirname + '/resources/graph.html') + '';
                html = html.replace('flowpipegraphdata', JSON.stringify({nodes: nodes, edges: edges}));
                fs.writeFileSync(save_path, html);
            }

            return {nodes: nodes, edges: edges};
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

                    args[0] = result;
                    args.unshift(null);
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

            if (!args[0] || args[0].length == 0) {
                args.unshift(null);
                return manager(args);
            }

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

        action.jump = function (next, args) {
            var work = flow[next];

            var jump = function () {
                var jump_to = arguments[0];
                arguments[0] = null;

                for (var i = 0; i < next_id.length; i++)
                    if (next_id[i] == jump_to)
                        proc = i;

                manager(arguments);
            };

            var exec = 'work(jump';
            for (var i = 0; i < args.length; i++)
                exec += ',args[' + i + ']'
            exec += ')';
            eval(exec);
        };

        return obj;
    };

    var obj = {};
    obj.init = function (next) {
        return flowpipe().init(next);
    };
    return obj;
})();