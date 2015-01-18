'use strict';

module.exports = function (options) {
	var bower = options.configs.bower;
	var src = options.paths.src;
	var templates = options.paths.templates;
	var scaffolding = require(src + '/scaffolding');
	var prompts = require(src + '/prompts');

	var conflict = options.require.conflict,
		gulp = options.require.gulp,
		gutil = options.require.gutil,
		prettify = options.require.prettify,
		rename = options.require.rename,
		template = options.require.template;

	gulp.task('provider', function (done) {

		var transport = {
			module: {
				prefix: bower.project.angular.prefix,
				ns: scaffolding.ns('.')
					.join('.')
			},
			provider: {}
		};

		if (gulp.args.length) {
			transport.provider.newName = gulp.args.join(' ');
		}

		prompts.providerName(transport)
			.then(scaffolding.moduleName)
			.then(scaffolding.providerName)
			.then(function (transport) {
				var partSubName = transport.provider.partSubName;
				transport[partSubName] = transport.provider;

				gulp.src([templates + '/module/**/module.provider*.js',
						templates + '/module/**/module.' + partSubName + '.spec.js'

					])
					.pipe(rename(function (path) {
						path.basename = path.basename.replace('module', transport.provider.slug);
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
				gutil.log(err);
			});
	});
};
