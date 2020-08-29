const rollup = require('rollup');
const rename = require('gulp-rename');
const uglify = require('gulp-uglify-es').default;
const concatCss = require('gulp-concat-css');
const path = require('path');

function joinPathToRoot(dest_dir) {
    return path.join(__dirname, '..', dest_dir);
}

//to establish watch task
function makeSafeGlob(src_folder, {file_ending, excluded_dirs}) {
    //defaults
    if (!file_ending) file_ending = 'js';
    //set up glob creation
    const glob_arr = [];
    const make_safe = (unsafe_glob) => {
        return unsafe_glob.split(path.sep).join('/');
    };
    const src_path = joinPathToRoot(src_folder);
    //create glob for included files
    const unsafe_glob_included = path.join(src_path, '**', `*.${file_ending}`); //bad on Windows
    const safe_glob_included = make_safe(unsafe_glob_included);
    glob_arr.push(safe_glob_included);
    //create globs for all files included in excluded directories
    excluded_dirs && excluded_dirs.forEach(dir_path => {
        const unsafe_glob_excluded = path.join(src_path, '**', dir_path, '**', '*'); //bad on Windows
        const safe_glob_excluded = make_safe(unsafe_glob_excluded);
        glob_arr.push('!' + safe_glob_excluded);
    });
    return glob_arr;
}

//to bundle js files together
function bundleJsScripts(src_folder, main_file, dist_folder, bundle_name, gulp,
                         {verbose_error} = {verbose_error: true}) {
    const src_path = joinPathToRoot(src_folder);
    const main_file_path = path.join(src_path, main_file);
    const dist_path = joinPathToRoot(dist_folder);
    const res_file_path = path.join(dist_path, `${bundle_name}.js`);
    return async () => {
        try {
            //bundle into module using rollup
            const bundle = await rollup.rollup({
                input: main_file_path,
            });
            await bundle.write({
                file: res_file_path,
                format: 'umd',
            });
            //minify bundled file
            gulp.src(res_file_path)
                .pipe(rename(`${bundle_name}.min.js`))
                .pipe(uglify())
                .pipe(gulp.dest(dist_path));
        } catch (err) {
            if (verbose_error) {
                console.log(err);
            } else {
                console.log('Bundle aborted: error in js file!');
            }
        }
    };
}

//to bundle css files together
function bundleCssFiles(src_folder, dist_folder, bundle_name, gulp,
                        {verbose_error} = {verbose_error: true}) {
    const src_glob = makeSafeGlob(src_folder, {file_ending: 'css'});
    const dist_path = joinPathToRoot(dist_folder);
    return async () => {
        gulp.src(src_glob)
            .pipe(concatCss(`${bundle_name}.css`))
            .on('error', (err) => {
                if (verbose_error) {
                    console.log(err);
                } else {
                    console.log('Bundle aborted: error in css file!');
                }
            }).pipe(gulp.dest(dist_path));
    };
}

module.exports = {
    makeSafeGlob,
    bundleJsScripts,
    bundleCssFiles,
};
