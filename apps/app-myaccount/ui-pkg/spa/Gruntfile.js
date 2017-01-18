//'use strict';

var fs = require('fs');
var path = require('path');
var _ = require('underscore');
var login = require('./login');
var snapi;
var sep = path.sep;
var appConfig = JSON.parse(fs.readFileSync('grunt_config.json', 'utf8'));
var globalContext = JSON.parse(fs.readFileSync('globalContext.json', 'utf8'));
var gsConfig = require('./gsConfigV2.json');
var scriptsPropsFileName = appConfig.scriptsPropsFileName || 'i18nPropsForScripts';
var i18nRegExp = /\/([a-zA-Z]{2}-[a-zA-Z]{2})\//;

try {
    snapi = require('snapi')({
        debug: true
    });
} catch (err) {
    console.error('In order to use SNAPI use Node v6.0.0. To have multiple node instance with in local download NVM.');
}

if (!process.env.SH_ENV) {
    process.env.SH_ENV = 'LOCAL';
}

_.extend(appConfig, globalContext);

module.exports = function(grunt) {

    var dispatch = require('dispatch');
    var proxySnippet = require('grunt-connect-proxy/lib/utils').proxyRequest;

    var copyOptions = {
        process:function(content, srcpath) {
            if (/index\.html/.test(srcpath)) {
                grunt.template.addDelimiters('curlyBraceDelimiters', '{%', '%}');
                return grunt.template.process(content, {'data': appConfig, 'delimiters': 'curlyBraceDelimiters'});
            } else {
                return content;
            }
        }
    };

    // generate the appFolder varaible into the appConfig object
    appConfig.appFolder = appConfig.appName + '-' + appConfig.appVersion;

    // Project configuration.
    grunt.initConfig({
        // Metadata.
        pkg: grunt.file.readJSON('package.json'),
        config: appConfig,
        appName: appConfig.appName,
        banner: '/*! <%= pkg.name %> v<%= pkg.version %>  (build <%= grunt.template.today("yyyy-mm-dd") %>)\n' +
            ' * <%= pkg.description %>\n *\n' +
            ' * <%= pkg.logo %>\n *\n' +
            ' * <%= pkg.homepage %>\n' +
            ' * <%= pkg.copyright %>\n' +
            ' * <%= pkg.license %>\n' +
            ' */\n',
        consoleNoop: 'if(typeof console === "undefined"){zz=function(){};console={log:zz,debug:zz,info:zz,warn:zz,error:zz,assert:zz,clear:zz,trace:zz};}',
        buildDevPath: "build-dev",
        buildProdPath: "build-prod",
        buildSeoPath: "build-seo",
        buildTestPath: "build-test",
        buildLibPath: "build-lib",
        resourcesPath: appConfig.resourcesPath,
        scriptsPropsFileName: scriptsPropsFileName,
        appUrlPath: appConfig.appUrlPath,
        scriptsFolder: "/scripts",
        stylesFolder: "/styles",
        imagesFolder: "/images",
        templatesFolder: "/templates",
        i18nFolder: "/i18n",
        appFolder: appConfig.appFolder,
        testPath: "test",
        localhostPortDev: 7777,
        localhostPortProd: 8888,
        localhostPortTest: 9999,
        featureResourcesPath: '<%= resourcesPath %>/<%= appFolder %>',
        featureScriptsPath: '<%= resourcesPath %><%= scriptsFolder %>/<%= appFolder %>',
        featureOptimizedScriptsPath: '<%= resourcesPath %><%= scriptsFolder %>/<%= appFolder %>/optimized/',
        featureStylesPath: '<%= resourcesPath %><%= stylesFolder %>/<%= appFolder %>',
        featureImagesPath: '<%= resourcesPath %><%= imagesFolder %>/<%= appFolder %>',
        featureTemplatesPath: '<%= resourcesPath %><%= templatesFolder %>/<%= appFolder %>',
        i18nRootPath: '<%= resourcesPath %><%= i18nFolder %>',
        featureBrandCurrent: 'blue_new',
        featureBrandNext: 'ticket-out',

        //Task for deleting files/folders for build directories
        clean: {
            dev: ['<%= buildDevPath %>/*'],
            prod: ['<%= buildProdPath %>/*'],
            test: ['<%= buildTestPath %>/*'],
            lib: ['<%= buildLibPath %>/*'],
            devI18n: [
                '<%= buildDevPath%><%= featureTemplatesPath %>/**/templates',
                '<%= buildDevPath%><%= i18nRootPath %>/*',
                '!<%= buildDevPath%><%= i18nRootPath %><%= commonFolder %>/**'
            ],
            prodI18n: [
                '<%= buildProdPath%><%= featureTemplatesPath %>/**/templates',
                '<%= buildProdPath%><%= i18nRootPath %>/*',
                '!<%= buildProdPath%><%= i18nRootPath %><%= commonFolder %>/**'
            ]
        },

        // Simple Connect server for unit test results page,
        // and to serve the html skeleton of app pages.
        connect: {
            dev: {
                options: {
                    hostname: '0.0.0.0',
                    port: 7777,
                    base: './<%= buildDevPath %>',
                    middleware: function(connect, options) {
                        // Return array of whatever middlewares you want
                        var middlewares = [
                            proxySnippet,
                            // allow any /foo URL to be served by index.html
                            dispatch({
                                '/:appUrlPath/(.*)': function (req, res, next, appUrlPath, path) {
                                    //NOTE: poor man's test to allow any file at the root level
                                    //to be served correctly
                                    if (path.indexOf('.') === -1) {
                                        grunt.log.writeln('req.url: ' + req.url);
                                        //redirect to root index.html
                                        req.url = '/'+ appUrlPath + '/';
                                    }
                                    next();
                                }
                            }),
                            connect.static(options.base),
                            connect.directory(options.base)
                        ];
                        if (snapi) {
                           middlewares.unshift(snapi.middleware());
                        }
                        return middlewares;
                    }
                },
                // config to proxy api calls "/api/xxxx" to port 7778
                proxies: appConfig.proxies

            },
            prod: {
                options: {
                    hostname: '0.0.0.0',
                    port: 8888,
                    base: './<%= buildProdPath %>',
                    keepalive: true,
                    middleware: function(connect, options) {
                        // Return array of whatever middlewares you want
                        return [
                            //setup api proxy
                            proxySnippet,
                            //NOTE: this is a temporary solution to allow
                            //any /foo URL to be served by index.html
                            dispatch({
                                    '/:appUrlPath/(.*)': function (req, res, next, appUrlPath, path) {
                                    //NOTE: poor man's test to allow any file at the root level
                                    //to be served correctly
                                    if (path.indexOf('.') === -1) {
                                        grunt.log.writeln('req.url: ' + req.url);
                                        //redirect to root index.html
                                        req.url = '/'+ appUrlPath + '/';
                                    }
                                    next();
                                }
                            }),
                            connect.static(options.base),
                            connect.directory(options.base)
                        ];
                    }
                },
                // config to proxy api calls "/api/xxxx" to port 7778
                proxies: appConfig.proxies
            },
            test: {
                options: {
                    port: 9999,
                    base: './<%= buildTestPath %>'
                }
            }
        },
        //Task to copy files from one dir to another.
        //TODO: may be some overlap. Investigate. If keeping, may need to be more specialized.
        copy: {
            dev: {
                files: [
                    { src: ['**/*.js'], dest: '<%= buildDevPath %><%= featureScriptsPath %>/', expand: true, cwd: 'app/scripts'},
                    { src: ['**/*.json'], dest: '<%= buildDevPath %><%= featureScriptsPath %>/', expand: true, cwd: 'app/scripts'},
                    { src: ['**/*.html'], dest: '<%= buildDevPath %><%= appUrlPath %>/', expand: true, cwd: 'app'},
                    { src: ['*.ico'], dest: '<%= buildDevPath %>/', expand: true, cwd: 'app'},
                    { src: ['*.txt'], dest: '<%= buildDevPath %>/', expand: true, cwd: 'app'},
                    // jiawzhang changes for unified controller.
                    { src: ['globalContext.json', '<%= appName %>.html'], dest: '<%= buildDevPath %><%= resourcesPath %>/unified-controller/<%= appName %>/', expand: true, cwd: ''}
                ], options: copyOptions
            },
            prod: {
                files: [
                    { src: ['**/*.js'], dest: '<%= buildProdPath %><%= featureScriptsPath %>/', expand: true, cwd: 'app/scripts'},
                    { src: ['**/*.map'], dest: '<%= buildProdPath %><%= featureScriptsPath %>/', expand: true, cwd: 'app/scripts'},
                    { src: ['*.ico'], dest: '<%= buildProdPath %>/', expand: true, cwd: 'app'},
                    { src: ['*.txt'], dest: '<%= buildProdPath %>/', expand: true, cwd: 'app'},
                    // jiawzhang changes for unified controller.
                    { src: ['globalContext.json', '<%= appName %>.html'], dest: '<%= buildProdPath %><%= resourcesPath %>/unified-controller/<%= appName %>/', expand: true, cwd: ''}
                ]
            },
            test: {
                files: [
                    { src: ['**/*.js'], dest: '<%= buildTestPath %><%= featureScriptsPath %>/', expand: true, cwd: 'app/scripts'},
                    { src: ['**/*.html'], dest: '<%= buildTestPath %>/', expand: true, cwd: 'app'},
                    { src: ['*.ico'], dest: '<%= buildTestPath %>/', expand: true, cwd: 'app'},
                    { src: ['*.txt'], dest: '<%= buildTestPath %>/', expand: true, cwd: 'app'}
                ]
            },
            imgDev: {
                files: [
                    { src: ['**/*.*'], dest: '<%= buildDevPath %><%= featureImagesPath %>/', expand: true, cwd: 'app/images'}
                ]
            },
            imgProd: {
                files: [
                    { src: ['**/*.*'], dest: '<%= buildProdPath %><%= featureImagesPath %>/', expand: true, cwd: 'app/images'}
                ]
            },
            imgTest: {
                files: [
                    { src: ['**/*.*'], dest: '<%= buildTestPath %><%= featureImagesPath %>/', expand: true, cwd: 'app/images'}
                ]
            }
        },
        preprocess: {
            html: {
                src: [
                    './<%= buildDevPath %>/**/index.html'
                ],
                options: {
                    context: {
                        gsConfig: JSON.stringify(gsConfig)
                    },
                    inline: true,
                    type: 'html'
                }
            },

            dev: {
                src: [
                    './<%= buildDevPath %><%= featureScriptsPath %>/**/*.js'
                ],
                options: {
                    context: {
                        appConfig: appConfig
                    },
                    inline: true
                }
            },

            prod: {
                src: ['./<%= buildProdPath %><%= featureScriptsPath %>/**/*.js'],
                options: {
                    inline: true
                }
            }
        },
        concat: {
            options: {
                separator: '\n'
            },
            dev: {
                rename: function(dest, src){
                    // console.log('\nsrc: ', src);
                    // console.log('\dest: ', dest);
                    var i18n;
                    if(i18n = i18nRegExp.exec(src)){
                        var pair = i18n[1].split('-');
                        var language = pair[0];
                        var country = pair[1];
                        var converted = language.toLowerCase() + '-' + country.toLowerCase();
                        dest = dest + converted + '/';
                    }
                    dest = dest + 'templates-bundle.js';
                    // console.log('--------dest: ', dest);
                    return dest;
                },
                expand:true,
                nonnull: true,
                dest: '<%= buildDevPath %><%= featureTemplatesPath %>/',
                src: ['<%= buildDevPath %><%= featureTemplatesPath %>/**/**/*.js']
            },
            prod: {
                rename: function(dest, src){
                    // console.log('\nsrc: ', src);
                    // console.log('\dest: ', dest);
                    var i18n;
                    if(i18n = i18nRegExp.exec(src)){
                        var pair = i18n[1].split('-');
                        var language = pair[0];
                        var country = pair[1];
                        var converted = language.toLowerCase() + '-' + country.toLowerCase();
                        dest = dest + converted + '/';
                    }
                    dest = dest + 'templates-bundle.js';
                    // console.log('--------dest: ', dest);
                    return dest;
                },
                expand:true,
                nonnull: true,
                dest: '<%= buildProdPath %><%= featureTemplatesPath %>/',
                src: ['<%= buildProdPath %><%= featureTemplatesPath %>/**/**/*.js']
            }
        },

        //Task to minify html and copy to prod directory.
        htmlmin: {
            dev: {
                files: [
                    { src: ['*.html'], dest: '<%= buildDevPath %>/', expand: true, cwd: 'app'}
                ]
            },
            prod: {
                options: {
                    removeComments: true,
                    collapseWhitespace: true
                },
                files: [
                    { src: ['**/*.html'], dest: '<%= buildProdPath %><%= appUrlPath %>/', expand: true, cwd: 'app'}
                ]
            },
            test: {
                files: [
                    { src: ['*.html'], dest: '<%= buildTestPath %>/', expand: true, cwd: 'app'}
                ]
            }
        },

        //Task to run jshint on configured directories.
        jshint: {
            gruntfile: {
                // options: {
                //   jshintrc: '.jshintrc'
                // },
                src: 'Gruntfile.js'
            },
            app: {
                options: {
                    jshintrc: 'app/scripts/.jshintrc'
                },
                src: ['app/scripts/**/*.js']
            },
            test: {
                options: {
                    jshintrc: '.jshintrc'
                },
                src: ['test/**/*.js',  '!test/lib/**/*.js']
            }
        },
        
        // Task to compile SASS files and copy them to dev or prod directories.
        sass: {
            dev: {
                files: [{
                    src: ['<%= featureBrandCurrent %>/app.scss'],
                    dest: '<%= buildDevPath %><%= featureStylesPath %>/',
                    expand: true,
                    flatten: true,
                    cwd: 'app/styles',
                    ext: '.css'
                }, {
                    src: ['<%= featureBrandNext %>/app.scss'],
                    dest: '<%= buildDevPath %><%= featureStylesPath %>/',
                    expand: true,
                    flatten: true,
                    cwd: 'app/styles',
                    ext: '.<%= featureBrandNext%>.css'
                }]
            },
            prod: {
                files: [{
                    src: ['<%= featureBrandCurrent %>/app.scss'],
                    dest: '<%= buildProdPath %><%= featureStylesPath %>/',
                    expand: true,
                    flatten: true,
                    cwd: 'app/styles',
                    ext: '.css'
                }, {
                    src: ['<%= featureBrandNext %>/app.scss'],
                    dest: '<%= buildProdPath %><%= featureStylesPath %>/',
                    expand: true,
                    flatten: true,
                    cwd: 'app/styles',
                    ext: '.<%= featureBrandNext%>.css'
                }]
            },
            test: {
                files: [{
                    src: ['<%= featureBrandCurrent %>/app.scss'],
                    dest: '<%= buildTestPath %><%= featureStylesPath %>/',
                    expand: true,
                    flatten: true,
                    cwd: 'app/styles',
                    ext: '.css'
                }, {
                    src: ['<%= featureBrandNext %>/app.scss'],
                    dest: '<%= buildTestPath %><%= featureStylesPath %>/',
                    expand: true,
                    flatten: true,
                    cwd: 'app/styles',
                    ext: '.<%= featureBrandNext%>.css'
                }]
            },
        },

        // Task to minfiy CSS.
        cssmin: {
            dev: {
                files: [{
                    expand: true,
                    cwd: '<%= buildDevPath %><%= featureStylesPath %>',
                    src: ['app.css'],
                    dest: '<%= buildDevPath %><%= featureStylesPath %>/',
                    ext: '.min.css'
                }, {
                    expand: true,
                    cwd: '<%= buildDevPath %><%= featureStylesPath %>',
                    src: ['app.<%= featureBrandNext %>.css'],
                    dest: '<%= buildDevPath %><%= featureStylesPath %>/',
                    ext: '.<%= featureBrandNext %>.min.css'
                }]
            },
            prod: {
                files: [{
                    expand: true,
                    cwd: '<%= buildProdPath %><%= featureStylesPath %>',
                    src: ['app.css'],
                    dest: '<%= buildProdPath %><%= featureStylesPath %>/',
                    ext: '.min.css'
                }, {
                    expand: true,
                    cwd: '<%= buildProdPath %><%= featureStylesPath %>',
                    src: ['app.<%= featureBrandNext %>.css'],
                    dest: '<%= buildProdPath %><%= featureStylesPath %>/',
                    ext: '.<%= featureBrandNext %>.min.css'
                }]
            },
            test: {
                files: [{
                    expand: true,
                    cwd: '<%= buildTestPath %><%= featureStylesPath %>',
                    src: ['app.css'],
                    dest: '<%= buildTestPath %><%= featureStylesPath %>/',
                    ext: '.min.css'
                }, {
                    expand: true,
                    cwd: '<%= buildTestPath %><%= featureStylesPath %>',
                    src: ['app.<%= featureBrandNext %>.css'],
                    dest: '<%= buildTestPath %><%= featureStylesPath %>/',
                    ext: '.<%= featureBrandNext %>.min.css'
                }]
            }
        },

        //Task to run require.js optimizer.
        requirejs: {
            dev: {
                options: {
                    // set build path as working directory
                    baseUrl: '<%= buildDevPath %><%= featureScriptsPath %>',
                    // set output path as specified in app config
                    out: '<%= buildDevPath %><%= featureOptimizedScriptsPath %><%= config.requirejsoptimizer.out %>',
                    // set included and excluded files as specified in app config
                    include: appConfig.requirejsoptimizer.include,
                    exclude: appConfig.requirejsoptimizer.exclude,
                    // no uglify optimization for dev build
                    optimize: "none",
                    // set build-time paths object with empty paths required for requirejs task
                    // WARNING: Actual runtime paths is defined in the app's config.js. Please keep these two definitions in sync
                    paths: appConfig.requirejsoptimizer.paths
                }
            },
            prod: {
                options: {
                    // set build path as working directory
                    baseUrl: '<%= buildProdPath %><%= featureScriptsPath %>',
                    // set output path as specified in app config
                    out: '<%= buildProdPath %><%= featureOptimizedScriptsPath %><%= config.requirejsoptimizer.out %>',
                    // set included and excluded files as specified in app config
                    include: appConfig.requirejsoptimizer.include,
                    exclude: appConfig.requirejsoptimizer.exclude,
                    // set uglify optimization for prod build
                    optimize: "uglify2",
                    uglify2: {
                        compress: {
                            drop_console: true
                        }
                    },
                    generateSourceMaps: true,
                    preserveLicenseComments: false,
                    // set build-time paths object with empty paths required for requirejs task
                    // WARNING: Actual runtime paths is defined in the app's config.js. Please keep these two definitions in sync
                    paths: appConfig.requirejsoptimizer.paths
                }
            }
        },

        watch: {
            gruntfile: {
                files: ['<%= jshint.gruntfile.src %>'],
                tasks: ['jshint:gruntfile']
            },
            app: {
                files: ['<%= jshint.app.src %>'],
                tasks: ['jshint:app']
            },
            test: {
                files: ['<%= jshint.test.src %>', '<%= jshint.app.src %>', '<%= testPath %>/templates/**/*.dust'],
                tasks: ['buildTest', 'jshint:test'],
                options: {
                    livereload: false
                }
            },
            dev: {
                files: ['app/**/*', 'gsConfig.json', 'grunt_config.json'],
                tasks: ['build']
            }
        },

        //Task to compile dust files.
        dustjs: {
            dev: {
                files: [
                    { src: ['**/*.dust'], dest: '<%= buildDevPath %><%= featureTemplatesPath %>/', expand: true, cwd: '<%= buildDevPath %><%= i18nRootPath %>/', ext: '.js'}
                ],
                options: {
                    fullname: function(filepath) {
                        return appConfig.appFolder + '/' + filepath.replace(/.*templates[^\w]*/i, '').replace(/\.dust/, '');
                    }
                }
            },
            prod: {
                files: [
                    { src: ['**/*.dust'], dest: '<%= buildProdPath %><%= featureTemplatesPath %>/', expand: true, cwd: '<%= buildProdPath %><%= i18nRootPath %>/', ext: '.js'}
                ],
                options: {
                    fullname: function(filepath) {
                        return appConfig.appFolder + '/' + filepath.replace(/.*templates[^\w]*/i, '').replace(/\.dust/, '');
                    }
                }
            },
            test: {
                files: [
                    { src: ['**/*.dust'], dest: '<%= buildTestPath %><%= featureTemplatesPath %>/', expand: true, cwd: 'app/templates', ext: '.js'},
                    { src: ['**/*.dust'], dest: '<%= buildTestPath %>/', expand: true, cwd: 'test/templates', ext: '.js'}
                ],
                options: {
                    fullname: function(filepath) {
                        return appConfig.appFolder + '/' + filepath.replace(/.*templates[^\w]*/i, '').replace(/\.dust/, '');
                    }
                }
            }
        },

        // renames JS/CSS to prepend a hash of their contents for easier
        // versioning
        rev: {
            js: '<%= buildDevPath %><%= featureResourcesPath %>/scripts/**/*.js',
            css: '<%= buildDevPath %><%= featureResourcesPath %>/styles/**/*.css',
            img: '<%= buildDevPath %><%= featureResourcesPath %>/images/**/*.*'
        },

        /*
        ** Precompile task used for the i18n
        **
        ** @option {Object} localeFilesExpandPatterns - A object value, normally it should specify the i18n/locales folder in the app source folder and where all the soruce files should be coped into the deployment build environment, this value normally is a pattern value which can be passed into the grunt API `grunt.file.expandMapping`
        ** @option {Array} implementedLocalesList - specify the implemented locales list for this application
        ** @option {Function} getTemplateFilePath - return the template file path in deployment folder structure, make sure the returned template file path should be in the same folder with the associated properties file like below:
                                                 i18n/<locale>/tempaltes/
                                                                        --header.poperties
                                                                        --header.dust
                              The key point in this example is the header.dust must be put together with the header.properties in the same folder
        ** @option {Function} getScriptsPropsFilePath - return the generated javascript properties file path in deployment folder structure
        ** @option {String} scriptsPropsFileName - specify the generated javascript properties file name
        */
        sh_precompile: {
            dev:{
                options:{
                    localeFilesExpandPatterns: {
                        src: ['**/*.properties'],
                        dest: '<%= buildDevPath %><%= i18nRootPath %>',
                        cwd: 'app/i18n',
                        rename: function(dest, matchedSrcPath, options) {
                            return path.join(dest, matchedSrcPath);
                        }
                    },
                    implementedLocalesList: appConfig.implementedLocalesList,
                    getTemplateFilePath: function (settings) {
                        var task = settings.task,
                            i18nRootPath = grunt.config.get([task.name, task.target, 'options', 'localeFilesExpandPatterns', 'dest']),
                            locale = settings.locale,
                            filepath = settings.filepath,
                            templatespath = '',
                            destpath = '';

                        templatespath = filepath.split(sep).slice(1).join(sep);
                        destpath = path.join(i18nRootPath, locale, templatespath);

                        return destpath;
                    },
                    getScriptsPropsFilePath: function (settings) {
                        var locale = settings.locale,
                            scriptsPropsFileName = settings.scriptsPropsFileName,
                            buildDevPath = grunt.config.get('buildDevPath'),
                            featureScriptsPath = grunt.config.get('featureScriptsPath'),
                            destpath = '';
                        
                        destpath = path.join(buildDevPath, featureScriptsPath, locale, scriptsPropsFileName + '.js');

                        return destpath;
                    },
                    scriptsPropsFileName: '<%= scriptsPropsFileName %>',
                    keyPrefix: '<%= appName %>'
                },
                src: ['app/templates/**/*.dust']
            },
            prod:{
                options:{
                    localeFilesExpandPatterns: {
                        src: ['**/*.properties'],
                        dest: '<%= buildProdPath %><%= i18nRootPath %>',
                        cwd: 'app/i18n'
                    },
                    implementedLocalesList: appConfig.implementedLocalesList,
                    getTemplateFilePath: function (settings) {
                        var task = settings.task,
                            i18nRootPath = grunt.config.get([task.name, task.target, 'options', 'localeFilesExpandPatterns', 'dest']),
                            locale = settings.locale,
                            filepath = settings.filepath,
                            templatespath = '',
                            destpath = '';
                            
                        templatespath = filepath.split(sep).slice(1).join(sep);
                        destpath = path.join(i18nRootPath, locale, templatespath);

                        return destpath;
                    },
                    getScriptsPropsFilePath: function (settings) {
                        var locale = settings.locale,
                            scriptsPropsFileName = settings.scriptsPropsFileName,
                            buildProdPath = grunt.config.get('buildProdPath'),
                            featureScriptsPath = grunt.config.get('featureScriptsPath'),
                            destpath = '';
                        
                        destpath = path.join(buildProdPath, featureScriptsPath, locale, scriptsPropsFileName + '.js');

                        return destpath;
                    },
                    scriptsPropsFileName: '<%= scriptsPropsFileName %>',
                    keyPrefix: '<%= appName %>'
                },
                src: ['app/templates/**/*.dust']
            }
        },

        eslint: {
            src: ['snapi/**/*.js', 'app/scripts/**/*.js', '!app/scripts/widget/*.js']
        }
    });

    // These plugins provide necessary tasks.
    grunt.loadNpmTasks('grunt-connect-proxy');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-connect');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-htmlmin');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-sass');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-contrib-requirejs');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-dustjs');
    grunt.loadNpmTasks('grunt-sh-precompile');
    grunt.loadNpmTasks('grunt-preprocess');
    grunt.loadNpmTasks('gruntify-eslint');

    // builds need to do the following (in brackets needs to run in prod build only):
    // - clean
    // - optimize and copy images   -> this should use 'imagemin:dev' but has version issues, so we use 'copy:imgDev' for now
    // - compile (and concat) and copy styles
    // - compile templates
    // - (optimize, concat and uglify) and copy scripts                  \
    // - (minify) and copy html     -> is an individual task for PROD     -> single copy task for DEV
    // - copy auxiliary files       -> is an individual task for PROD    /


    // test task to run unit tests
    grunt.registerTask('testUnit',
        ('Unit tests').red + ('\nRuns the unit tests').yellow,
        ['mocha']);

    // test task to run both unit and functional tests
    grunt.registerTask('test',
        ('Unit plus functional tests').red + ('\nRuns the unit and functional tests for the DEV build').yellow,
        ['testUnit', 'testFunc']);

    //build task to compile and copy source code to build-test
    grunt.registerTask('buildTest',
        ('TEST build').red + ('\nCompiles and copies source code to ').yellow + ('build-test').red + (' folder').yellow,
        ['clean:test', 'copy:imgTest', 'compileSass:test', 'cssmin:test', 'dustjs:test', 'copy:test']);

    // build task to compile and copy source code to build-dev
    grunt.registerTask('build',
        ('DEV build').red + ('\nCompiles and copies source code to ').yellow + ('build-dev').red + (' folder').yellow,
        ['login', 'clean:dev', 'eslint', 'copy:imgDev', 'compileSass:dev', 'cssmin:dev', 'sh_precompile:dev', 'dustjs:dev', 'concat:dev', 'copy:dev', 'preprocess:dev', 'preprocess:html', 'clean:devI18n', 'requirejs:dev']);

    // server task to start PROD server
    grunt.registerTask('serverProd',
        ('PROD server').red + ('\nBuilds code and starts a web server for the PROD build at ').yellow + ('http://localhost:8888' + appConfig.appUrlPath + '/').white,
        ['buildProd', 'configureProxies:prod', 'connect:prod']);

    // tests task to run functional tests for PROD build
    grunt.registerTask('testFuncProd',
        ('PROD functional tests').red + ('\nRuns the functional tests for the PROD build').yellow,
        ['casper:prod']);

    // build task to compile and copy source code to build-prod
    grunt.registerTask('buildProd',
        ('PROD build').red + ('\nCompiles, optimizes and copies source code to ').yellow + ('build-prod').red + (' folder').yellow,
        ['clean:prod', 'eslint', 'copy:imgProd', 'compileSass:prod', 'cssmin:prod', 'sh_precompile:prod', 'dustjs:prod', 'concat:prod', 'copy:prod', 'preprocess:prod', 'clean:prodI18n', 'requirejs:prod', 'htmlmin:prod']);

    // test task to run functional tests for DEV build
    grunt.registerTask('testFunc',
        ('<<<<< DEV functional tests <').red.bold + ('\nRuns the functional tests for the DEV build').yellow,
        ['casper:dev']);

    // server task to start TEST server
    grunt.registerTask('serverTest',
        ('<<<<< DEV unit test server <').red.bold + ('\nStarts a web server for the UNIT TEST results at ').yellow + ('http://localhost:9999/unit.html').white,
        ['buildTest', 'connect:test', 'watch:test']);

    // server task to start DEV server
    grunt.registerTask('server',
        ('<<<<< DEV server < ').red.bold + ('\nBuilds code and starts a web server for the DEV build at ').yellow + ('http://localhost:7777' + appConfig.appUrlPath + '/').white + (' and watches for code changes').yellow,
        ['build', 'configureProxies:dev', 'connect:dev', 'watch:dev']);
        
    // Injects Sass globals and compiles Sass
    grunt.registerTask('compileSass', function (env) {
        console.log('compileSass', env);

        // Write Sass Globals to _globals_.scss file
        fs.writeFileSync("app/styles/_globals_.scss", "/* Written by GruntFile */\r\n$baseImgUrl: \"" + grunt.config.get("featureImagesPath") + "\";");
        
        grunt.task.run('sass:' + env);
    });

    grunt.registerTask('login', 'Login to the env and pass tokens', function () {
        var done = this.async();
        login(function (loginToken) {
            console.log(loginToken);
            appConfig.loginToken = loginToken;
            // begin of config proxy headers for all URL prefixed with /shape
            appConfig.proxies[0].headers = {
                'Accept-Language': appConfig.locale,
                'Authorization': 'Bearer ' + loginToken.access_token
            };
            // end of config proxy headers for all URL prefixed with /shape
            done(loginToken);
        });
    });
};
