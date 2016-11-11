'use strict';

module.exports = (()=> {
    let app = {};

    app.older = require('./v0.4');

    let assert = (condition, message)=> {
        if (!condition) {
            message = message || "Assertion failed";
            if (typeof Error !== "undefined") {
                throw new Error(message);
            }
            throw message;
        }
    };

    let instance = function (instanceName) {
        if (!instanceName) instanceName = 'flowpipe-' + new Date().getTime();

        let works = {};
        let order = [];
        let args = {};
        let MAX_THREAD = 10;
        let AUTO_INCREASED = 0;
        this.then = this.add = this.pipe = (name, work)=> {
            if (!work) {
                work = name;
                name = work.name;
                if (!name || name == '') {
                    name = 'auto-' + AUTO_INCREASED;
                    AUTO_INCREASED++;
                }
            }
            order.push({type: 'work', name: name});
            works[name] = work;
            return this;
        };

        this.for = this.loop = this.loopback = (name, condition)=> {
            order.push({type: 'loop', to: name, condition: condition});
            return this;
        };

        this.init = (configure)=> {
            order.push({type: 'init', configure: configure});
            return this;
        };

        this.timestamp = (display)=> {
            order.push({type: 'timestamp', display: display});
            return this;
        };

        this.log = (display)=> {
            order.push({type: 'log', display: display});
            return this;
        }

        this.parallel = (setter, work)=> {
            order.push({type: 'parallel', set: setter, do: work});
            return this;
        };

        this.args = args;

        this.list = ()=> order;
        this.maxThread = (maxThread)=> {
            order.push({type: 'MAX_THREAD', MAX_THREAD: maxThread});
            return this;
        };

        this.run = this.start = this.end = this.finish = (callback)=> {
            let starttime = new Date().getTime();
            let pretime = new Date().getTime();

            let manager = (wi)=> {
                if (typeof wi == 'undefined') wi = 0;
                let indicate = order[wi];
                if (!indicate) {
                    if (callback) callback(args);
                    return;
                }

                if (indicate.type !== 'timestamp')
                    pretime = new Date().getTime();

                if (indicate.type === 'work') {
                    works[indicate.name](args).then((result)=> {
                        if (typeof result === 'object')
                            for (let key in result)
                                args[key] = result[key];
                        manager(wi + 1);
                    }).catch((e)=> {
                        console.log(`[${instanceName}] ERROR IN "${indicate.name}"`);
                        console.log(e);
                    });
                } else if (indicate.type === 'loop') {
                    try {
                        if (indicate.condition(args)) {
                            for (let i = 0; i < order.length; i++)
                                if (order[i].name === indicate.to)
                                    wi = i;
                        } else {
                            wi++;
                        }
                        manager(wi);
                    } catch (e) {
                        console.log(`[${instanceName}] ERROR IN loop "${indicate.condition.toString()}"`);
                        console.log(e);
                    }
                } else if (indicate.type === 'init') {
                    try {
                        indicate.configure(args);
                        manager(wi + 1);
                    } catch (e) {
                        console.log(`[${instanceName}] ERROR IN init "${indicate.configure.toString()}"`);
                        console.log(e);
                    }
                } else if (indicate.type === 'parallel') {
                    try {
                        let pdata = indicate.set(args);
                        let pCnt = 0;
                        let pidx = 0;
                        let proceed = 0;
                        let parallelWork = ()=> {
                            if (!pdata[pidx]) return;
                            if (pCnt > MAX_THREAD) return;
                            pCnt++;
                            indicate.do(args, pdata[pidx], pidx).then(()=> {
                                proceed++;
                                pCnt--;

                                if (proceed === pdata.length) {
                                    manager(wi + 1);
                                    return;
                                }
                                parallelWork();
                            });

                            pidx++;
                            parallelWork();
                        };

                        parallelWork();
                    } catch (e) {
                        console.log(`[${instanceName}] ERROR IN parallel "${indicate.set.toString()}"`);
                        console.log(e);
                    }
                } else if (indicate.type === 'MAX_THREAD') {
                    MAX_THREAD = indicate.MAX_THREAD;
                    manager(wi + 1);
                } else if (indicate.type === 'log') {
                    try {
                        console.log(`[${instanceName}] ${indicate.display(args)}`);
                    } catch (e) {
                    }
                    manager(wi + 1);
                } else if (indicate.type === 'timestamp') {
                    try {
                        console.log(`[${instanceName}] ${indicate.display(new Date().getTime() - starttime, new Date().getTime() - pretime)}`);
                    } catch (e) {
                    }
                    manager(wi + 1);
                }
            };

            manager();
        };
    };

    app.instance = (instanceName)=> {
        return new instance(instanceName);
    };

    return app;
})();