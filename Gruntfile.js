module.exports = function (grunt) {

    grunt.loadNpmTasks('grunt-exec');
    grunt.loadNpmTasks('assemble-less');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-clean');

    grunt.initConfig({
        clean: {
            production: {
                src: [
                    './cmpltmpl/*', '!./cmpltmpl/__init__.py', './public/files/js/min/*'
                ]
            }
        },
        exec: {
            compile_html_templates: {
                cmd: 'find ./templates -name "*.tmpl" -exec sh -c \'T=$(echo {}); T=${T#./templates/}; cheetah compile --odir cmpltmpl --idir templates "$T"\' \\;'
            }
        },
        "less": {
            production: {
                files: {
                    "public/files/css/kontext.min.css": [
                        "public/files/css/bonito.less",
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
                expand: true,
                cwd: 'public/files/js/',
                src: ['**/*.js', '!public/files/js/min/*', '!**/*.min.js'],
                dest: 'public/files/js/min/'
            }
        },
        "copy": {
            production: {
                files: [
                    {expand: true, cwd: 'public/files/js', src: '**/*.min.js', dest: 'public/files/js/min'}
                ]
            }
        }

    });


    grunt.registerTask('default', ['clean', 'exec', 'less', 'uglify', 'copy']);
};