(function (module) {
    'use strict';

    module.exports = function (grunt) {

        let kontext = require('./scripts/build/kontext');
        grunt.loadNpmTasks('grunt-exec');
        grunt.loadNpmTasks('assemble-less');
        grunt.loadNpmTasks('grunt-contrib-uglify');
        grunt.loadNpmTasks('grunt-contrib-copy');
        grunt.loadNpmTasks('grunt-contrib-clean');
        grunt.loadNpmTasks('grunt-ts');
        grunt.loadNpmTasks('grunt-contrib-requirejs');
        grunt.loadNpmTasks('grunt-babel');

        grunt.initConfig({
            clean: {
                all: {
                    src: [
                        './cmpltmpl/*',
                        '!./cmpltmpl/__init__.py',
                        './public/files/js/min/*',
                        './public/files/js/compiled/*',
                        './public/files/js/optimized/*'
                    ]
                },
                templates: {
                    src: [
                        './cmpltmpl/*',
                        '!./cmpltmpl/__init__.py'
                    ]
                },
                javascript: {
                    src: [
                        './public/files/js/min/*',
                        './public/files/js/compiled/*',
                        './public/files/js/optimized/*'
                    ]
                },
                jsKeepVendor: {
                    src: [
                        './public/files/js/min/*',
                        '!./public/files/js/min/vendor',
                        './public/files/js/compiled/*',
                        './public/files/js/optimized/*'
                    ]
                },
                cleanup: {
                    src: [
                        './public/files/js/optimized/*',
                        './public/files/js/compiled/*'
                    ]
                },
                production: {
                    src: [
                        'public/files/js/optimized/*',
                        'public/files/js/compiled/*',
                        'public/files/js/min/*',
                        '!public/files/js/min/vendor',
                        'public/files/js/min/vendor/immutable.min.js',
                        'public/files/js/min/vendor/qunit.js',
                        'public/files/js/min/vendor/react.dev.js',
                        'public/files/js/min/vendor/rsvp-ajax.js',
                        'public/files/js/min/vendor/cookies.js',
                        'public/files/js/min/vendor/less.js',
                        'public/files/js/min/vendor/react-dom.dev.js',
                        'public/files/js/min/vendor/rsvp.min.js',
                        'public/files/js/min/vendor/d3.min.js',
                        'public/files/js/min/vendor/invariant.js',
                        'public/files/js/min/vendor/react-dom.min.js',
                        'public/files/js/min/vendor/soundmanager2.min.js',
                        'public/files/js/min/vendor/Dispatcher.js',
                        'public/files/js/min/vendor/jquery.min.js',
                        'public/files/js/min/vendor/react.min.js',
                        '!public/files/js/min/tpl',
                    ]
                }
            },
            exec: {
                tmpl: {
                    cmd: 'find ./templates -name "*.tmpl" -exec sh -c \'T=$(echo {}); T=${T#./templates/}; cheetah compile --odir cmpltmpl --idir templates "$T"\' \\;'
                },
                cql_grammar: {
                    cmd: 'mkdir -p public/files/js/compiled/cqlParser; ./node_modules/pegjs/bin/pegjs --format amd --allowed-start-rules Query,RegExpRaw,PhraseQuery -o public/files/js/compiled/cqlParser/parser.js scripts/build/cql.pegjs'
                }
            },
            "less": {
                production: {
                    files: {
                        "public/files/css/kontext.min.css": (function () {
                            let ans = [
                                "public/files/css/kontext.less",
                                "public/files/css/view.less",
                                "public/files/css/widgets.less",
                                "public/files/css/keyboard.css"
                            ];
                            return ans.concat(kontext.getCustomStyles('./conf/config.xml', './public/files/js/plugins'));
                        }())
                    },
                    options: {
                        compress: true
                    }
                },
                devel: {
                    files: {
                        "public/files/css/custom.min.css": kontext.getCustomStyles('./conf/config.xml',
                                './public/files/js/plugins')
                    },
                    options: {
                        compress: true
                    }
                }
            },
            "uglify": {
                compiled: {
                    files: [
                        {
                            expand: true,
                            cwd: 'public/files/js/compiled',
                            src: ['**/*.js'],
                            dest: 'public/files/js/optimized'
                        }
                    ]
                }
            },
            "copy": {
                devel: {
                    files: [
                        {
                            expand: true,
                            cwd: 'public/files/js',
                            src: ['**/*.js', '!min/**', '!compiled/**', '!optimized/**'],
                            dest: 'public/files/js/optimized'
                        },
                        {
                            expand: true,
                            cwd: 'public/files/js/compiled',
                            src: ['**/*.js', '!min/**', '!compiled/**', '!optimized/**'],
                            dest: 'public/files/js/optimized'
                        }
                    ]
                },
                dummyCompile: {
                    files: [
                        {
                            expand: true,
                            cwd: 'public/files/js',
                            src: ['**/*.js', '!**/*.min.js', '!min/**', '!compiled/**', '!optimized/**'],
                            dest: 'public/files/js/compiled'
                        }
                    ]
                },
                preMinified: {
                    files: [
                        {
                            expand: true,
                            cwd: 'public/files/js',
                            src: ['**/*.min.js', '!min/**', '!compiled/**', '!optimized/**'],
                            dest: 'public/files/js/optimized'
                        }
                    ]
                },
                dummyOptimize: {
                    files: [
                        {
                            expand: true,
                            cwd: 'public/files/js/compiled',
                            src: ['**/*.js', '!vendor/*'],
                            dest: 'public/files/js/min'
                        }
                    ]
                }
            },
            "ts": {
                devel: {
                    files: [
                        {
                            src: ["public/files/js/**/*.ts"],
                            dest: "public/files/js/compiled"
                        }
                    ],
                    options: {
                        module: 'amd',
                        target: 'es5',
                        rootDir: 'public/files/js',
                        sourceMap: true,
                        declaration: true
                    }
                },
                production: {
                    files: [
                        {
                            src: ["public/files/js/**/*.ts"],
                            dest: "public/files/js/compiled"
                        }
                    ],
                    options: {
                        module: 'amd',
                        target: 'es5',
                        rootDir: 'public/files/js',
                        sourceMap: false,
                        declaration: false
                    }
                }
            },
            "babel": {
                options: {
                    plugins: ['transform-react-jsx', "transform-es2015-modules-amd"],
                    presets: ['es2015', 'react'],
                },
                all: {
                    files: [
                        {
                            expand: true,
                            cwd: 'public/files/js',
                            src: ["**/*.jsx"],
                            dest: "public/files/js/compiled",
                            ext: ".js"
                        }
                    ]
                }
            },
            requirejs: {
                production: {
                    options: {
                        appDir: "public/files/js/optimized",
                        baseUrl: ".",
                        dir: "public/files/js/min",
                        shim: {},
                        wrapShim: true,
                        optimize: 'none',
                        paths: kontext.loadModulePathMap('./conf/config.xml', './public/files/js/plugins', true),
                        modules: kontext.listAppModules('./public/files/js/tpl')
                            .concat(kontext.listPackedModules(true))
                    }
                },
                vendor: {
                    options: {
                        appDir: "public/files/js/optimized",
                        baseUrl: ".",
                        dir: "public/files/js/min",
                        wrapShim: true,
                        optimize: 'none',
                        paths: kontext.loadModulePathMap('./conf/config.xml', './public/files/js/plugins', false),
                        modules: kontext.listPackedModules(false)
                    }
                }
            },
            translations: {
                devel: {
                    targetFile: './public/files/js/min/translations.js'
                },
                production: {
                    targetFile: './public/files/js/optimized/translations.js'
                }
            },
            keymaps: {
                any: {
                    targetFile: './public/files/misc/kb-layouts.min.json'
                }
            }
        });

        // generates client-side translations file by merging individual 'messages.json' files
        grunt.registerMultiTask('translations', function () {
            kontext.mergeTranslations('./public', this.data.targetFile);
        });

        grunt.registerMultiTask('keymaps', function () {
            kontext.minifyJSONFile('./scripts/build/kb-layouts.json', this.data.targetFile);
        });

        // generates development-ready project (i.e. no minimizations/optimizations)
        grunt.registerTask('devel', ['clean:all', 'less:devel', 'exec:cql_grammar',
                'keymaps:any', 'ts:devel', 'babel', 'copy:dummyCompile', 'copy:devel',
                'requirejs:vendor', 'translations:devel', 'clean:cleanup', 'exec:tmpl']);

        // regenerates JavaScript files for development-ready project (i.e. no min./optimizations
        // and no Cheetah templates compiled)
        grunt.registerTask('develjs', ['clean:jsKeepVendor', 'less:devel', 'exec:cql_grammar',
                'keymaps:any', 'ts:devel', 'babel', 'copy:dummyCompile',
                'copy:dummyOptimize', 'translations:devel', 'clean:cleanup']);

        // generates production-ready project with additional optimization of JavaScript files
        // (RequireJS optimizer)
        grunt.registerTask('production', ['clean:all', 'less', 'exec:cql_grammar',
                'keymaps:any', 'ts:production', 'babel', 'copy:dummyCompile',
                'uglify:compiled', 'copy:preMinified',
                'translations:production', 'requirejs:production',
                'clean:production', 'exec:tmpl']);

        // just compiles Cheetah templates
        grunt.registerTask('templates', ['clean:templates', 'exec:tmpl']);
    };
}(module));
