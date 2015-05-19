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
                nonOptimized: {
                    files: [
                        {
                            expand: true,
                            cwd: 'public/files/js/',
                            src: ['**/*.js', '!min/*', '!**/*.min.js', '!compiled/**'],
                            dest: 'public/files/js/min/'
                        },
                        {
                            expand: true,
                            cwd: 'public/files/js/compiled',
                            src: ['**/*.js'],
                            dest: 'public/files/js/min/'
                        }
                    ]
                },
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
                            src: ['**/*.js', '!compiled/**', '!vendor/**'],
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
                finishNonOptimized: {
                    files: [
                        {
                            expand: true,
                            cwd: 'public/files/js/compiled',
                            src: ['**/*.js'],
                            dest: 'public/files/js/min'
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
                        paths: kontext.loadPluginMap('./config.xml'),
                        modules: kontext.listAppModules('./public/files/js/tpl')
                            .concat(kontext.listVendorModules())
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
                        paths: kontext.loadPluginMap('./config.xml'),
                        modules: kontext.listVendorModules()
                    }
                }
            }
        });

        // generates development-ready project (i.e. no minimizations/optimizations)
        grunt.registerTask('devel', ['clean:all', 'typescript', 'react', 'requirejs:vendor',
            'copy:devel', 'clean:cleanup', 'exec']);

        // regenerates JavaScript files for development-ready project (i.e. no min./optimizations
        // and no Cheetah templates compiled)
        grunt.registerTask('develjs', ['clean:javascript', 'typescript', 'react',
            'requirejs:vendor', 'copy:devel', 'clean:cleanup']);

        // generates production-ready project with additional optimization of JavaScript files
        // (RequireJS optimizer)
        grunt.registerTask('production-optimized', ['clean:all', 'less', 'typescript', 'react',
            'copy:prepare', 'requirejs:production',
            'copy:finishOptimized', 'uglify:optimized', 'clean:cleanup', 'exec']);

        // generates production-ready project where all JavaScript modules are loaded individually
        grunt.registerTask('production', ['clean:all', 'less', 'typescript', 'react', 'copy:prepare',
            'copy:finishNonOptimized', 'uglify:nonOptimized', 'clean:cleanup', 'exec']);

        // generates production-like project with RequireJS optimization but without minimization
        grunt.registerTask('production-debug', ['clean:all', 'less', 'typescript', 'copy:prepare',
            'requirejs:production', 'copy:finishOptimized', 'clean:cleanup', 'exec']);

        // just compiles Cheetah templates
        grunt.registerTask('templates', ['clean:templates', 'exec:compile_html_templates']);
    };
}(module));