var flowpipe = require('flowpipe');
var request = require('request');
var cheerio = require('cheerio');
var mysql = require('mysql');

var category_list = [
    {title: '경제', id: 949986},
    {title: '정치', id: 950203},
    {title: '사회', id: 949987},
    {title: '생활/문화', id: 949988},
    {title: '세계', id: 949990},
    {title: 'IT/과학', id: 949984}
];

flowpipe
    .init(function (next) {
        var query = {};
        query.date = new Date('2015-01-01');
        next(null, query);
    })
    .pipe('dateloop', function (next, query) {
        query.category = 0;
        next(null, query);
    })
    .pipe('categoryloop', function (next, query) {
        query.page = 1;
        next(null, query);
    })
    .pipe('pageloop', function (next, query) {
        setTimeout(function () {
            var dateformat = query.date.format('yyyy-MM-dd 00:00:00');
            var category = category_list[query.category];
            var url = 'http://news.naver.com/main/mainNews.nhn?componentId=' + category.id + '&date=' + dateformat + '&page=' + query.page;
            next(null, query, url);
        }, 500)
    })
    .pipe('getHtml', function (next, query, url) {
        request.get({
            url: url,
            encoding: 'binary'
        }, function (err, res, body) {
            if (err) return next(err);

            try {
                var charSet = 'euc-kr';
                body = new Buffer(body, 'binary');
                var Iconv = require('iconv').Iconv;
                var ic = new Iconv(charSet, 'utf-8');
                body = ic.convert(body).toString();
            } catch (e) {
            }

            var data = JSON.parse(body).itemList;
            next(null, query, data);
        });
    })
    .pipe('parse', function (next, query, data) {
        var result = [];
        var category = category_list[query.category];
        for (var i = 0; i < data.length; i++)
            result.push({
                title: data[i].titleWithUnescapeHtml,
                category: category.title,
                articleDate: data[i].articleDate,
                articleId: data[i].articleId,
                officeId: data[i].officeId,
                href: 'http://news.naver.com/main/read.nhn?mode=LSD&mid=shm&sid1=105&oid=' + data[i].officeId + '&aid=' + data[i].articleId
            });

        next(null, query, result);
    })
    .loopback('pipe-pageloop', function (loop, next, instance, query, result) {
        if (!instance.result) instance.result = [];
        if (!instance.pre) instance.pre = [];
        for (var i = 0; i < result.length; i++)
            for (var j = 0; j < instance.pre.length; j++)
                if (result[i].articleId == instance.pre[j].articleId)
                    return next(null, instance.result, query);
        for (var i = 0; i < result.length; i++)
            instance.result.push(result[i]);
        instance.pre = result;

        query.page += 1;
        loop(null, query);
    })
    .parallel('getContent', function (next, data) {
        request.get({
            url: data.href,
            encoding: 'binary'
        }, function (err, res, body) {
            if (err) return next(err);

            try {
                var charSet = 'euc-kr';
                body = new Buffer(body, 'binary');
                var Iconv = require('iconv').Iconv;
                var ic = new Iconv(charSet, 'utf-8');
                body = ic.convert(body).toString();
            } catch (e) {
            }
            var $ = cheerio.load(body);
            data.text = $('#articleBodyContents').text().trim();
            next(null, data);
        });
    })
    .pipe('createDB', function (next, parsed, query) {
        var connection = mysql.createConnection({
            "host": "localhost",
            "user": "root",
            "password": "",
            "database": "async"
        });

        next(null, parsed, connection, query);
    })
    .parallel('insertDB', function (next, data, connection) {
        connection.query('INSERT INTO news VALUES(?,?,?,?,?,?,?)', [data.articleId, data.category, data.title, data.articleDate, data.officeId, data.href, data.text], function (err) {
            next(null, err ? err : 'no-error');
        });
    })
    .pipe('closeDB', function (next, errors, connection, query) {
        var errorCnt = 0;
        for (var i = 0; i < errors.length; i++)
            if (errors[i] != 'no-error') errorCnt++;

        console.log(
            '[' + query.date.format('yyyy-MM-dd') + ']',
            '[' + category_list[query.category].title + ']',
            errors.length, 'data parsed.',
            errorCnt, 'error at inserting.'
        );

        connection.end(function () {
            next(null, query);
        });
    })
    .loopback('pipe-categoryloop', function (loop, next, instance, query) {
        query.category += 1;
        if (category_list[query.category])
            loop(null, query);
        else {
            next(null, query);
        }
    })
    .loopback('pipe-dateloop', function (loop, next, instance, query) {
        if (query.date.getTime() < new Date('2015-12-31').getTime()) {
            query.date = query.date.day(+1);
            loop(null, query);
        } else {
            next(null);
        }
    })
    .end().graph('news-parser.html');

// Date Format Prototypes
Date.prototype.day = function (val) {
    return new Date(this.getTime() + val * 1000 * 60 * 60 * 24);
};

Date.prototype.format = function (f) {
    if (!this.valueOf()) return " ";

    var weekName = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
    var d = this;

    return f.replace(/(yyyy|yy|MM|dd|E|hh|mm|ss|a\/p)/gi, function ($1) {
        switch ($1) {
            case "yyyy":
                return d.getFullYear();
            case "yy":
                return (d.getFullYear() % 1000).zf(2);
            case "MM":
                return (d.getMonth() + 1).zf(2);
            case "dd":
                return d.getDate().zf(2);
            case "E":
                return weekName[d.getDay()];
            case "HH":
                return d.getHours().zf(2);
            case "hh":
                return ((h = d.getHours() % 12) ? h : 12).zf(2);
            case "mm":
                return d.getMinutes().zf(2);
            case "ss":
                return d.getSeconds().zf(2);
            case "a/p":
                return d.getHours() < 12 ? "오전" : "오후";
            default:
                return $1;
        }
    });
};

String.prototype.string = function (len) {
    var s = '', i = 0;
    while (i++ < len) {
        s += this;
    }
    return s;
};

String.prototype.zf = function (len) {
    return "0".string(len - this.length) + this;
};

Number.prototype.zf = function (len) {
    return this.toString().zf(len);
};