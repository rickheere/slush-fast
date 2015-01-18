'use strict';

var _ = require('lodash'),
	_s = require('underscore.string'),
	concat = require('gulp-concat'),
	extend = require('extend'),
	globule = require('globule'),
	fs = require('fs'),
	install = require('gulp-install'),
	jeditor = require('gulp-json-editor'),
	path = require('path'),
	Q = require('Q');

module.exports = function (options) {

	var src = options.paths.src;
	var scaffolding = require(src + '/scaffolding');
	var prompts = require(src + '/prompts');
	var conflict = options.require.conflict,
		gulp = options.require.gulp,
		gutil = options.require.gutil,
		prettify = options.require.prettify,
		rename = options.require.rename,
		template = options.require.template;
	var seq = require('gulp-sequence')
		.use(gulp);

	var globs = {
		bootstrap: {
			src: options.paths.templates + '/application/*/bootstrap.js'
		},
		index: {
			src: options.paths.templates + '/application/*/index.html'
		},
		gulpfile: {
			src: options.paths.templates + '/application/gulpfile.js'
		},
		npm: {
			src: options.paths.templates + '/application/package.json',
			target: './package.json'
		},
		bower: {
			src: options.paths.templates + '/application/bower.json',
			target: './bower.json'
		},
		docs: {
			readme: {
				includes: {
					src: options.paths.docs + '/**/*.md'
				},
				project: {
					src: options.paths.docs + '/README.project.md',
					dest: './README.md'
				},
				generator: {
					src: options.paths.docs + '/README.generator.md',
					dest: './README.md'
				}
			}
		}
	};
	var defaults = createDefaults();

	gulp.task('readme', function (done) {

		var readme = extend({}, defaults, defaults.bower);
		gutil.log('Preparing README files');
		prepareReadme(readme, function () {
			gulp.src(globs.docs.readme.project.src)
				.pipe(template(readme))
				.pipe(concat(globs.docs.readme.project.dest))
				.pipe(conflict(globs.docs.readme.project.dest))
				.pipe(gulp.dest('./'))
				.on('end', function (err) {
					if (err) {
						gutil.log(gutil.colors.red('Failed to create project readme.'));
					} else {
						gutil.log('Project readme created.');
					}

					done(err, true);
				});
		});
	});

	gulp.task('init', function (done) {
		// prompt for app specific values
		prompts.application(defaults)
			.then(function (answers) {
				extend(defaults, {
					install: answers.install,
					description: answers.appDescription,
					version: answers.appVersion,
					authors: [{
						name: answers.authorName,
						email: answers.authorEmail
					}],
					repository: {
						type: 'git',
						url: answers.appRepository
					}
				});
				extend(defaults.project.name, {
					full: answers.appName,
					slug: _s.slugify(answers.appName)
				});

				extend(defaults.project.angular, {
					prefix: scaffolding.prefixName(answers.appPrefix)
				});
				var bootstrapModuleName = defaults.project.angular.prefix + '.' +
					answers.bootstrapModule;
				extend(defaults.project.angular.bootstrap, {
					module: bootstrapModuleName,
					element: _s.slugify(bootstrapModuleName.split('.')
						.join('-')) + '-app'
				});

				_.extend(defaults, {

					module: {
						prefix: scaffolding.prefixName(answers.appPrefix),
						ns: '',
						newNs: answers.bootstrapModule
					}
				});
				return Q.resolve(defaults);
			})
			.then(scaffolding.moduleName)
			.then(function () {
				seq(
					[
						'create-bower-json',
						'create-package-json'
					], [
						'update-bower-json',
						'update-package-json'
					], [
						'copy-files',
						'copy-special-files'
					],
					'readme', [
						'create-module',
						'create-readme'
					],
					'install-npm-modules',
					'show-help',
					done);
			});
	});

	gulp.task('copy-files', function () {
		var butNot = [globs.bootstrap.src, globs.index.src, globs.gulpfile.src,
				globs.bower.src, globs.npm.src
			]
			.map(
				function (glob) {
					return '!' + glob;
				});

		return gulp.src([options.paths.templates + '/application/**/*'].concat(
				butNot))
			.pipe(template(defaults))
			.pipe(rename(function (file) {
				if (file.basename[0] === '_') {
					file.basename = '.' + file.basename.slice(1);
				}
			}))
			.pipe(conflict('./'))
			.pipe(gulp.dest('./'));
	});

	gulp.task('copy-special-files', function () {

		return gulp.src([globs.bootstrap.src, globs.index.src, globs.gulpfile.src])
			.pipe(conflict('./'))
			.pipe(gulp.dest('./'));
	});

	gulp.task('create-module', function () {

		return gulp.src([
				options.paths.templates + '/module/module.js'
				/*, templates + '/module/module.scenario.js' */
			])
			.pipe(rename(function (path) {
				path.basename = defaults.module.name + '.' + path.basename;
			}))
			.pipe(template(defaults))
			.pipe(prettify(options.prettify))
			.pipe(conflict('./src/app/' + defaults.module.name +
				'/'))
			.pipe(gulp.dest('./src/app/' + defaults.module.name +
				'/'));
	});

	gulp.task('create-readme', function (done) {
		// references defaults
		done();
	});

	gulp.task('create-bower-json', function (done) {
		if (!fs.existsSync(globs.bower.target)) {
			gulp.src(globs.bower.src)
				.pipe(gulp.dest('./'))
				.on('finish', function () {
					done();
				});
		} else {
			done();
		}
	});

	gulp.task('update-bower-json', function () {
		return gulp.src(globs.bower.target)
			.pipe(jeditor(function (json) {
				extend(json, {
					name: defaults.project.name.slug, // string
					description: defaults.description, // string
					version: defaults.version, // string
					authors: defaults.authors, // array or object, in our case an array
					repository: defaults.repository,
					project: {
						name: defaults.project.name,
						angular: defaults.project.angular,
						includes: defaults.project.includes
					}
				});

				return json;
			}))
			.pipe(gulp.dest('./'));
	});

	// package.json
	gulp.task('create-package-json', function (done) {
		if (!fs.existsSync(globs.npm.target)) {
			gulp.src(globs.npm.src)
				.pipe(gulp.dest('./'))
				.on('finish', function () {
					done();
				});
		} else {
			done();
		}
	});

	gulp.task('update-package-json', function () {
		return gulp.src(globs.npm.target)
			.pipe(jeditor(function (json) {
				extend(json, {
					name: defaults.project.name.slug, // string
					description: defaults.description, // string
					version: defaults.version, // string
					contributors: defaults.authors, // array
					repository: defaults.repository // object
				});

				return json;
			}))
			.pipe(gulp.dest('./'));
	});

	gulp.task('install-npm-modules', function (done) {
		if (!defaults.install) {
			done();
		} else {
			return gulp.src('./package.json')
				.pipe(install());
		}
	});

	gulp.task('show-help', function () {
		gutil.log(gutil.colors.bgYellow(gutil.colors.green(
				'Your project has been generated, type gulp help for usage information.'
			))

		);
	});

	function prepareReadme(answers, callback) {
		answers.readme = {};

		globule.find(globs.docs.readme.includes.src)
			.map(function (file) {
				var value = fs.readFileSync(file, 'utf8');
				var key = path.basename(file, '.md');
				answers.readme[key] = _.template(value)(answers);
			});
		callback();
	}

	function createDefaults() {

		var bower = options.configs.bower;

		var templateBower = scaffolding.findBower(options.paths.templates +
			'/application/');

		var workingDirName = scaffolding.getWorkingDirName();
		var repositoryUrl = scaffolding.getGitRepositoryUrl();
		var gitUser = scaffolding.getGitUser();

		gitUser = gitUser || {};
		var bootstrapModule = '';
		var project = bower.project || templateBower.project;
		extend(project.name, {
			full: workingDirName,
			slug: _s.slugify(workingDirName)
		});

		var defaults = {
			authors: bower.authors,
			appName: project.name.slug,
			description: bower.description || '',
			version: bower.version || '0.0.0',
			userName: format(gitUser.name), // TODO: where did this come from? -> || osUserName,
			authorEmail: gitUser.email || '',
			mainFile: bower.main || '',
			appRepository: repositoryUrl ? repositoryUrl : '',
			bootstrapModule: bootstrapModule,
			appPrefix: project.angular.prefix,
			bower: bower,
			slush: options.slush,
			project: project
		};

		if (gitUser) {
			if (gitUser.name) {
				defaults.authorName = gitUser.name;
			}
			if (gitUser.email) {
				defaults.authorEmail = gitUser.email;
			}
		}

		return defaults;
	}
};

function format(string) {
	if (string) {

		var username = string.toLowerCase();
		return username.replace(/\s/g, '');
	}
}
