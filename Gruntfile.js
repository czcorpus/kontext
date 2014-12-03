module.exports = function (grunt) {

    grunt.loadNpmTasks('grunt-exec');
    grunt.loadNpmTasks('assemble-less');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-typescript');

    grunt.initConfig({
        clean : {
            all : {
                src: [
                    './cmpltmpl/*',
                    '!./cmpltmpl/__init__.py',
                    './public/files/js/min/*',
                    './public/files/js/compiled/*'
                ]
            },
            javascript : {
                src: [
                    './public/files/js/min/*',
                    './public/files/js/compiled/*'
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
            production: {                
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
            production : {
                files : [
                    {
                        expand: true, 
                        cwd: 'public/files/js', 
                        src: ['**/*.min.js', '!min/*'], 
                        dest: 'public/files/js/min'
                    }
                ]
            }
        },
        "typescript": {
            all : {
                files : [
                    {
                        cwd : 'public/files/ts',
                        src : ["**/*.ts"],
                        dest : "public/files/js/compiled"
                    }
                ],
                options : {
                    module: 'amd',
                    target: 'es5',
                    basePath: 'public/files/ts',
                    sourceMap: true,
                    declaration: true
                }
            }
        }
    });

    grunt.registerTask('develjs', ['clean:javascript', 'typescript', 'copy:devel']);
    grunt.registerTask('devel', ['clean:all', 'typescript', 'copy:devel', 'exec']);
    grunt.registerTask('production', ['clean:all', 'less', 'typescript', 'uglify', 'copy:production', 'exec']);    
};