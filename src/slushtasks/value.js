'use strict';

module.exports = function (options) {

	var bower = options.configs.bower;
	var src = options.paths.src;
	var templates = options.paths.templates;
	var scaffolding = require(src + '/scaffolding');
	var prompts = require(src + '/prompts');

	var conflict = options.require.conflict,
		gulp = options.require.gulp,
		prettify = options.require.prettify,
		rename = options.require.rename,
		template = options.require.template;

	gulp.task('value', function (done) {

		var transport = {
			module: {
				prefix: bower.project.angular.prefix,
				ns: scaffolding.ns('.')
					.join('.')
			},
			value: {}
		};

		if (gulp.args.length) {
			transport.value.newName = gulp.args.join(' ');
		}

		prompts.valueName(transport)
			.then(scaffolding.moduleName)
			.then(scaffolding.valueName)
			.then(function (transport) {
				gulp.src([templates + '/module/**/module.value*.js'])
					.pipe(rename(function (path) {
						path.basename = path.basename.replace('module', transport.value.slug);
					}))
					.pipe(template(transport))
					.pipe(prettify(options.settings.prettify))
					.pipe(conflict('./'))
					.pipe(gulp.dest('./'))
					.on('finish', function () {
						done();
					});
			})
			.catch(function (err) {
				console.log(err);
			});
	});
};
