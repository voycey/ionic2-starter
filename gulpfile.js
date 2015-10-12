/******************************************************************************
 * Gulpfile
 * Be sure to run `npm install` for `gulp` and the following tasks to be
 * available from the command line. All tasks are run using `gulp taskName`.
 ******************************************************************************/

// node module imports
var gulp = require('gulp'),
    webpack = require('webpack'),
    minimist = require('minimist'),
    sass = require('gulp-sass'),
    autoprefixer = require('gulp-autoprefixer'),
    watch = require('gulp-watch'),
    browserSync = require('browser-sync'),
    through2 = require('through2'),
    ts = require('typescript'),
    fs = require('fs'),
    reload = browserSync.reload;


var IONIC_DIR = "node_modules/ionic-framework/"
//var IONIC_DIR = "node_modules/ionic2/dist/"

gulp.task('routes', function(){
  var routes = [];
  var appPath;

  return gulp.src('www/app/**/*.{js,ts}')
    .pipe(through2.obj(function(file, enc, next){
      var contents = file.contents.toString();
      var sourceFile = ts.createSourceFile('', contents, ts.ScriptTarget.ES6, true);
      ts.forEachChild(sourceFile, function(node){
        if (node.decorators) {
          for (var  i = 0, ii = node.decorators.length; i < ii; i++) {
            try {
              if (node.decorators[i].expression.expression.text === "Page") {
                var route = routes.filter(function(e){ return e.path === file.path });
                if (route.length > 0) {
                  route[0].pages.push(node.name.text);
                } else {
                  routes.push({ pages: [node.name.text], path: file.path });
                }
              } else if (node.decorators[i].expression.expression.text === "App") {
                appPath = file.path;
              }
            } catch(e) {}
          }
        }
      });

      next();
    }))
    .on('end', function(){
      var i = 0;
      routes = generateImportPaths(appPath, routes);
      var importStatements = generateImportStatements(routes).join("");
      var appEntryFile = fs.readFileSync(appPath, 'utf-8');
      appEntryFile = importStatements + appEntryFile;
      fs.writeFileSync(appPath, appEntryFile);
    });
})

function generateImportPaths(appPath, routes) {
  routes.forEach(function(route){
    // remove .ts or .js
    path = route.path.slice(0, -3);

    // get path relative to file where @App is
    var i = 0;
    var ii = appPath.length;
    var importPath;
    while(i < ii && appPath.charAt(i) === path.charAt(i)) i++;
    importPath = path.substring(i, path.length);

    // make it relative
    importPath = './' + importPath;

    route.path = importPath;
  })

  return routes;
}

function generateImportStatements(routes){
  return routes.map(function(route){
    return "import {" + route.pages.join(", ") + "} from '" + route.path + "';\n";
  });
}

/******************************************************************************
 * watch
 * Build the app, and rebuild when source files change.
 * Also starts a local web server.
 ******************************************************************************/
gulp.task('watch', ['sass', 'fonts'], function(done) {
  watch('www/app/**/*.scss', function(){
    gulp.start('sass');
  });
  compile(true, function(){
    done();
  });
});


/******************************************************************************
 * build
 * Build the app once, without watching for source file changes.
 ******************************************************************************/
gulp.task('build', ['sass', 'fonts'], function(done) {
  compile(false, done);
});


/******************************************************************************
 * serve
 * Start a local web server serving the 'www' directory.
 * The default is http://localhost:8100. Use the optional '--port'
 * flag to specify a different port.
 ******************************************************************************/
gulp.task('serve', function() {
  browserSync({
    server: {
      baseDir: 'www',
    },
    port: flags.port,
    files: [
      'www/**/*.html'
    ],
    notify: false
  });
});


/******************************************************************************
 * sass
 * Convert Sass files to a single bundled CSS file. Uses auto-prefixer
 * to automatically add required vendor prefixes when needed.
 ******************************************************************************/
gulp.task('sass', function(){
  var autoprefixerOpts = {
    browsers: [
      'last 2 versions',
      'iOS >= 7',
      'Android >= 4',
      'Explorer >= 10',
      'ExplorerMobile >= 11'
    ],
    cascade: false
  };

  return gulp.src('www/app/app.scss')
    .pipe(sass({
      includePaths: [IONIC_DIR + 'src/scss'],
    }))
    .on('error', function(err){
      console.error(err.message);
      this.emit('end');
    })
    .pipe(autoprefixer(autoprefixerOpts))
    .pipe(gulp.dest('www/build/css'))
    .pipe(reload({ stream: true }));
});


/******************************************************************************
 * fonts
 * Copy Ionic font files to build directory.
 ******************************************************************************/
gulp.task('fonts', function() {
  return gulp.src([
      IONIC_DIR + 'fonts/**/*.ttf',
      IONIC_DIR + 'fonts/**/*.woff'
    ])
    .pipe(gulp.dest('www/build/fonts'));
});


/******************************************************************************
 * clean
 * Delete previous build files.
 ******************************************************************************/
gulp.task('clean', function(done) {
  var del = require('del');
  del(['www/build'], done);
});



/******************************************************************************
 * Compile
 ******************************************************************************/
function compile(watch, cb) {
  // prevent gulp calling done callback more than once when watching
  var firstTime = true;

  // load webpack config
  var config = require('./webpack.config.js');

  // https://github.com/webpack/docs/wiki/node.js-api#statstojsonoptions
  var statsOptions = {
    'colors': true,
    'modules': true,
    'chunks': false,
    'exclude': ['node_modules']
  }

  // run (one time compile) or watch
  // https://github.com/webpack/docs/wiki/node.js-api
  var compilerFunc = (watch ? 'watch' : 'run');
  var compilerFuncArgs = [compileHandler];
  watch && compilerFuncArgs.unshift(null); // watch takes config obj as first arg

  // Call compiler.run(compileHandler) or compiler.watch(null, compileHandler)
  var compiler = webpack(config);
  compiler[compilerFunc].apply(compiler, compilerFuncArgs);

  function compileHandler(err, stats){
    if (firstTime) {
      firstTime = false;
      cb();
    } else {
      reload();
    }

    // print build stats and errors
    console.log(stats.toString(statsOptions));
  }
}


// command line flag config
var flagConfig = {
  string: 'port',
  default: { port: 8100 }
};
var flags = minimist(process.argv.slice(2), flagConfig);


function findIonicViewClass(output){
  var programBody = output.ast.program.body;

  // var MyClass = (function () {
  var varNodes = programBody.filter(function(node) {
    return node.type === "VariableDeclaration";
  });
  if (varNodes) {
    return varNodes.map(function(node){
      try {
        var declarationBodies = node.declarations[0].init.callee.body.body;

        // Get all expressions, we want one like this:
        // MyClass = (0, _ionicIonic.IonicView)({ ... })(MyClass)
        var expressionNodes = declarationBodies.filter(function(node){
          return node.type === "ExpressionStatement";
        });
        for (var i = 0, ii = expressionNodes.length; i < ii; i++) {
          try {
            // two expressions, 0 and _ionicIonic.IonicView
            // (0, _ionicIonic.IonicView)
            var expressions = expressionNodes[i].expression.right.left.callee.callee.expressions;
            for (var j = 0, jj = expressions.length; j < jj; j++) {
              if (expressions[j].property && expressions[j].property.name &&
                  expressions[j].property.name === "IonicView") {

                // Get class name from expression argument
                // (0, _ionicIonic.IonicView)({ ... })(MyClass)
                return expressionNodes[i].expression.right.left.arguments[0].name;
              }
            }
            return null
          } catch(e) {} //Keep going,
        }
        return null;
      } catch (e) {
        return null;
      }
    }).filter(function(e){ return e !== null });
  } else {
    return [];
  }
}
