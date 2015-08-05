(function (module) {
    'use strict';

    module.exports = function (grunt) {

        var kontext = require('./scripts/grunt/kontext');

        grunt.loadNpmTasks('grunt-exec');
        grunt.loadNpmTasks('assemble-less');
        grunt.loadNpmTasks('grunt-contrib-uglify');
        grunt.loadNpmTasks('grunt-contrib-copy');
        grunt.loadNpmTasks('grunt-contrib-clean');
        grunt.loadNpmTasks('grunt-typescript');
        grunt.loadNpmTasks('grunt-requirejs');
        grunt.loadNpmTasks('grunt-react');

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
                cleanup: {
                    src: [
                        './public/files/js/optimized/*',
                        './public/files/js/compiled/*'
                    ]
                }
            },
            exec: {
                compile_html_templates: {
                    cmd: 'find ./templates -name "*.tmpl" -exec sh -c \'T=$(echo {}); T=${T#./templates/}; cheetah compile --odir cmpltmpl --idir templates "$T"\' \\;'
                },
                update_app: {
                    cmd: 'touch public/app.py'
                }
            },
            "less": {
                production: {
                    files: {
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
                optimized: {
                    files: [
                        {
                            expand: true,
                            cwd: 'public/files/js/optimized',
                            src: ['**/*.js'],
                            dest: 'public/files/js/min/'
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
                            src: ['**/*.js', '!compiled/**', '!vendor/**', '!min/**'],
                            dest: 'public/files/js/min'
                        },
                        {
                            expand: true,
                            cwd: 'public/files/js/compiled', // typescript is always compiled
                            src: ['**/*.js'],
                            dest: 'public/files/js/min'
                        }
                    ]
                },
                prepare: {
                    files: [
                        {
                            expand: true,
                            cwd: 'public/files/js',
                            src: ['**/*.js', '!min/**', '!compiled/**', '!optimized/**', '!*.ts'],
                            dest: 'public/files/js/compiled'
                        }
                    ]
                },
                finishOptimized: {
                    files: [
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
                all: {
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
                }
            },
            "react": {
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
                        appDir: "public/files/js/compiled",
                        baseUrl: ".",
                        dir: "public/files/js/optimized",
                        shim: {
                            'vendor/jscrollpane': {
                                deps: ['jquery']
                            },
                            'typeahead': {
                                deps: ['jquery']
                            }
                        },
                        wrapShim: true,
                        optimize: 'none',
                        paths: kontext.loadPluginMap('./conf/config.xml', true),
                        modules: kontext.listAppModules('./public/files/js/tpl')
                            .concat(kontext.listPackedModules(true))
                    }
                },
                vendor: {
                    options: {
                        appDir: "public/files/js",
                        baseUrl: ".",
                        dir: "public/files/js/min",
                        shim: {
                            'vendor/jscrollpane': {
                                deps: ['jquery']
                            }
                        },
                        wrapShim: true,
                        optimize: 'none',
                        paths: kontext.loadPluginMap('./conf/config.xml', false),
                        modules: kontext.listPackedModules(false)
                    }
                }
            },
            translations: {
                devel: {
                    targetFile: './public/files/js/min/translations.js'
                },
                production: {
                    targetFile: './public/files/js/compiled/translations.js'
                }
            }
        });

        // generates client-side translations file by merging individual 'messages.json' files
        grunt.registerMultiTask('translations', function () {
            kontext.mergeTranslations('./public', this.data.targetFile);
        });

        // generates development-ready project (i.e. no minimizations/optimizations)
        grunt.registerTask('devel', ['clean:all', 'typescript', 'react',
                'requirejs:vendor', 'translations:devel', 'copy:devel', 'clean:cleanup', 'exec']);

        // regenerates JavaScript files for development-ready project (i.e. no min./optimizations
        // and no Cheetah templates compiled)
        grunt.registerTask('develjs', ['clean:javascript', 'typescript',
                'react', 'requirejs:vendor', 'translations:devel', 'copy:devel', 'clean:cleanup']);

        // generates production-ready project with additional optimization of JavaScript files
        // (RequireJS optimizer)
        grunt.registerTask('production', ['clean:all', 'less', 'typescript', 'react',
                'copy:prepare', 'translations:production', 'requirejs:production',
                'copy:finishOptimized', 'uglify:optimized', 'clean:cleanup', 'exec']);

        // just compiles Cheetah templates
        grunt.registerTask('templates', ['clean:templates', 'exec:compile_html_templates']);
    };
}(module));