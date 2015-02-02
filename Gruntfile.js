module.exports = function (grunt) {


    function loadPluginMap() {
        var modules = {
            'application_bar' : 'applicationBar',
            'query_storage' : 'queryStorage',
            'live_attributes' : 'liveAttributes'
        };
        var fs = require('fs');
        var data = fs.readFileSync('./config.xml', {encoding: 'utf8'});
        var DOMParser = require('xmldom').DOMParser;
        var doc = new DOMParser().parseFromString(data);
        var pluginMap = {
            'win' : 'empty:',
            'conf' : 'empty:',
            'jquery' : 'empty:',
            'SoundManager' : 'vendor/soundmanager2.min',
            'vendor/jscrollpane' : 'vendor/jscrollpane.min'
        }
        for (var p in modules) {
            var elms = doc.getElementsByTagName(p);
            if (elms[0]) {
                var jsElm = elms[0].getElementsByTagName('js_module');
                pluginMap['plugins/' + modules[p]] = 'plugins/' + jsElm[0].textContent;
            }
        };
        return pluginMap;
    }

    grunt.loadNpmTasks('grunt-exec');
    grunt.loadNpmTasks('assemble-less');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-typescript');
    grunt.loadNpmTasks('grunt-requirejs');

    grunt.initConfig({
        clean : {
            all : {
                src: [
                    './cmpltmpl/*',
                    '!./cmpltmpl/__init__.py',
                    './public/files/js/min/*',
                    './public/files/js/compiled/*',
                    './public/files/js/optimized/*'
                ]
            },
            javascript : {
                src: [
                    './public/files/js/min/*',
                    './public/files/js/compiled/*',
                    './public/files/js/optimized/*'
                ]
            }                        
        },
        exec : {
            compile_html_templates : {
                cmd : 'find ./templates -name "*.tmpl" -exec sh -c \'T=$(echo {}); T=${T#./templates/}; cheetah compile --odir cmpltmpl --idir templates "$T"\' \\;'
            },
            update_app : {
                cmd : 'touch public/app.py'
            }
        },
        "less" : {
            production : {
                files : {
                    "public/files/css/kontext.min.css": [
                        "public/files/css/kontext.less",
                        "public/files/css/view.less",
                        "public/files/css/widgets.less"
                    ]
                },
                options: {
                    compress: true
                }
            }
        },
        "uglify": {
            nonOptimized: {                
                files : [ 
                    {
                        expand : true,
                        cwd : 'public/files/js/',
                        src : ['**/*.js', '!min/*', '!**/*.min.js', '!compiled/**'], 
                        dest : 'public/files/js/min/' 
                    },
                    {
                        expand : true,
                        cwd : 'public/files/js/compiled',
                        src : ['**/*.js'], 
                        dest : 'public/files/js/min/'
                    }
                ]                
            },
            optimized : {
                files : [
                    {
                        expand : true,
                        cwd : 'public/files/js/optimized',
                        src : ['**/*.js'],
                        dest : 'public/files/js/min/'
                    },
                ]
            }
        },
        "copy": {
            devel : {
                files : [
                    {
                        expand: true, 
                        cwd: 'public/files/js', 
                        src: ['**/*.js', '!compiled/**'], 
                        dest: 'public/files/js/min'
                    },
                    {
                        expand: true, 
                        cwd: 'public/files/js/compiled', 
                        src: ['**/*.js'], 
                        dest: 'public/files/js/min'
                    }
                ]                
            },
            prepare : {
                files : [
                    {
                        expand: true, 
                        cwd: 'public/files/js', 
                        src: ['**/*.js', '!min/**', '!compiled/**', '!optimized/**', '!*.ts'],
                        dest: 'public/files/js/compiled'
                    }
                    ],
            },
            finishNonOptimized : {
                files : [
                    {
                        expand: true,
                        cwd: 'public/files/js/compiled',
                        src: ['**/*.js'],
                        dest: 'public/files/js/min'
                    }
                ]
            },
            finishOptimized : {
                files : [
                    {
                        expand: true,
                        cwd: 'public/files/js/optimized',
                        src: ['**/*.js'],
                        dest: 'public/files/js/min'
                    }
                ]
            }
        },
        "typescript": {
            all : {
                files : [
                    {
                        src : ["public/files/js/**/*.ts"],
                        dest : "public/files/js/compiled"
                    }
                ],
                options : {
                    module: 'amd',
                    target: 'es5',
                    basePath: 'public/files/js',
                    sourceMap: true,
                    declaration: true
                }
            }
        },
        requirejs: {
            compile: {
                options: {
                    appDir : "public/files/js/compiled",
                    baseUrl: ".",
                    dir : "public/files/js/optimized",
                    shim : {
                        'vendor/jscrollpane' : {
                            deps: ['jquery']
                        },
                        'typeahead' : {
                            deps: ['jquery']
                        }
                    },
                    wrapShim : true,
                    optimize : 'none',
                    paths : loadPluginMap(),
                    modules : [
                        { name : 'tpl/concDesc' },
                        { name : 'tpl/corplist' },
                        { name : 'tpl/filterForm' },
                        { name : 'tpl/firstForm' },
                        { name : 'tpl/freq' },
                        { name : 'tpl/queryHistory' },
                        { name : 'tpl/savecollForm' },
                        { name : 'tpl/saveconcForm' },
                        { name : 'tpl/savefreqForm' },
                        { name : 'tpl/savewlForm' },
                        { name : 'tpl/sort' },
                        { name : 'tpl/stats' },
                        { name : 'tpl/subcorp' },
                        { name : 'tpl/subcorpForm' },
                        { name : 'tpl/subcorpList' },
                        { name : 'tpl/view' },
                        { name : 'tpl/viewattrs' },
                        { name : 'tpl/wordlist' },
                        { name : 'tpl/wordlistForm' }
                    ],

                }
            }
        }
    });

    grunt.registerTask('develjs', ['clean:javascript', 'typescript', 'copy:devel']);

    grunt.registerTask('devel', ['clean:all', 'typescript', 'copy:devel', 'exec']);

    grunt.registerTask('production-optimized', ['clean:all', 'less', 'typescript', 'copy:prepare', 'requirejs:compile',
                       'copy:finishOptimized', 'uglify:optimized', 'exec']);

    grunt.registerTask('production', ['clean:all', 'less', 'typescript', 'copy:prepare',
                       'copy:finishNonOptimized', 'uglify:nonOptimized', 'exec']);    

    grunt.registerTask('production-debug', ['clean:all', 'less', 'typescript', 'copy:prepare', 'requirejs:compile',
                       'copy:finishOptimized', 'exec']);
};
