const gulp = require('gulp');
const {makeSafeGlob, bundleJsScripts, bundleCssFiles} = require('./gulp_tasks/fileBundling');

// SETUP

const lobby_css = {
    src_folder: 'client/css/lobby',
    dist_folder: 'client/css/dist',
    bundle_name: 'lobby',
};
const game_css = {
    src_folder: 'client/css/game',
    dist_folder: 'client/css/dist',
    bundle_name: 'game',
};

const lobby = {
    src_folder: 'client/js',
    main_file: 'lobby.js',
    dist_folder: 'client/js/dist',
    bundle_name: 'lobby',
};

const game = {
    src_folder: 'client/js',
    main_file: 'game.js',
    dist_folder: 'client/js/dist',
    bundle_name: 'game',
};

const bundle_tasks = [
    {
        script_task_name: 'create lobby js dist',
        watch_task_name: 'watch lobby js files',
        excluded_dirs: ['dist'],
        input: lobby,
        type: 'js-bundle',
    },
    {
        script_task_name: 'create game js dist',
        watch_task_name: 'watch game js files',
        excluded_dirs: ['dist'],
        input: game,
        type: 'js-bundle',
    },
    {
        script_task_name: 'create game css dist',
        watch_task_name: 'watch game css files',
        input: game_css,
        type: 'css-bundle',
    },
    {
        script_task_name: 'create lobby css dist',
        watch_task_name: 'watch lobby css files',
        input: lobby_css,
        type: 'css-bundle',
    }
];

// CREATE TASKS HELPER FUNCTION

function createTasks(task_info) {
    switch (task_info.type) {
        case 'js-bundle':
            createJsBundleTasks(task_info);
            break;
        case 'css-bundle':
            createCssBundleTasks(task_info);
            break;
    }
}
function createJsBundleTasks({script_task_name, watch_task_name, input, excluded_dirs}) {
    const {src_folder, main_file, dist_folder, bundle_name} = input;
    //create script task
    gulp.task(script_task_name, bundleJsScripts(src_folder, main_file, dist_folder,
        bundle_name, gulp, {verbose_error: true}));
    //create watch task for safe glob
    const fileGlob = makeSafeGlob(src_folder, {
        file_ending: 'js',
        excluded_dirs: excluded_dirs,
    });
    gulp.task(watch_task_name, () => {
        gulp.watch(fileGlob, gulp.series(script_task_name));
    });
}
function createCssBundleTasks({script_task_name, watch_task_name, input}) {
    const {src_folder, dist_folder, bundle_name} = input;
    //create script task
    gulp.task(script_task_name, bundleCssFiles(src_folder, dist_folder,
        bundle_name, gulp, {verbose_error: false}));
    //create watch task for safe glob
    const fileGlob = makeSafeGlob(src_folder, {file_ending: 'css'});
    gulp.task(watch_task_name, () => {
        gulp.watch(fileGlob, gulp.series(script_task_name));
    });
}

// ACTUAL TASK CREATION + NOTE TASK NAMES FOR TASK SERIALIZATION

const script_task_names = [];
const watch_task_names = [];
bundle_tasks.forEach(task_info => {
    createTasks(task_info); //task creation
    script_task_names.push(task_info.script_task_name);
    watch_task_names.push(task_info.watch_task_name);
});

// SERIALIZE TASKS IN GULP

gulp.task('default', gulp.series(...script_task_names, gulp.parallel(...watch_task_names)));
