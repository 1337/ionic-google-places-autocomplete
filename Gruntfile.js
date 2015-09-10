/*
 * ionic-google-places-autocomplete
 *
 * Copyright (c) 2014 "kuhnza" David Kuhn
 * Licensed under the MIT license.
 * https://github.com/kuhnza/ionic-google-places-autocomplete/blob/master/LICENSE
 */
(function () {
    "use strict";

    module.exports = function (grunt) {
        // Load grunt tasks automatically
        require('load-grunt-tasks')(grunt);

        var pixrem = require('pixrem');
        var autoprefixer = require('autoprefixer');
        var cssnano = require('cssnano');

        grunt.loadNpmTasks('grunt-postcss');

        grunt.initConfig({
            karma: {
                unit: {
                    configFile: 'karma.conf.js',
                    singleRun: true
                }
            },
            clean: {
                dist: {src: 'dist', dot: true},
                bower: {src: 'bower_components', dot: true}
            },
            bower: {
                install: {options: {targetDir: 'example/lib'}}
            },
            cssmin: {
                dist: {
                    expand: true,
                    cwd: 'dist/',
                    files: {
                        'dist/autocomplete.min.css': 'src/autocomplete.css'
                    }
                }
            },
            postcss: {
                options: {
                    map: true, // inline sourcemaps
                    processors: [
                        pixrem(), // add fallbacks for rem units
                        autoprefixer({
                            browsers: 'last 2 versions'
                        }), // add vendor prefixes
                        cssnano()  // minify the result
                    ]
                },
                dist: {
                    src: 'css/*.css'
                }
            },
            uglify: {
                dist: {
                    files: {
                        'dist/autocomplete.min.js': 'src/autocomplete.js'
                    }
                }
            }
        });

        grunt.registerTask('test', [
            'karma'
        ]);

        grunt.registerTask('build', [
            'clean',
            'bower',
            'cssmin',
            'uglify'
        ]);

        grunt.registerTask('default', ['build']);
    };

}());
