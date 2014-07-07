/*!
 * jQuery periodic plugin
 *
 * Copyright 2010, Tom Anderson
 * Dual licensed under the MIT or GPL Version 2 licenses.
 *
 */
define(['jquery'], function ($) {
    'use strict';

    $.periodic = function (options, callback) {

        var settings,
            run,
            ajaxComplete,
            increment,
            reset,
            cancel,
            pause,
            resume,
            log;

        // run (or restart if already running) the looping construct
        run = function () {
            // clear/stop existing timer (multiple calls to run() won't result in multiple timers)
            cancel();
            // let it rip!
            settings.tid = setTimeout(function() {
                // set the context (this) for the callback to the settings object
                callback.call(settings);

                // compute the next value for cur_period
                increment();

                // queue up the next run
                if(settings.tid)
                    run();
            }, settings.cur_period);
        };

        // utility function for use with ajax calls
        ajaxComplete = function (xhr, status) {
            if (status === 'success' && prev_ajax_response !== xhr.responseText) {
                // reset the period whenever the response changes
                prev_ajax_response = xhr.responseText;
                reset();
            }
        };

        // compute the next delay
        increment = function () {
            settings.cur_period *= settings.decay;
            if (settings.cur_period < settings.period) {
                // don't let it drop below the minimum
                reset();
            } else if (settings.cur_period > settings.max_period) {
                settings.cur_period = settings.max_period;
                if (settings.on_max !== undefined) {
                    // call the user-supplied callback if we reach max_period
                    settings.on_max.call(settings);
                }
            }
        };

        reset = function () {
            settings.cur_period = settings.period;
            // restart with the new timeout
            run();
        };

        cancel = function () {
            clearTimeout(settings.tid);
            settings.tid = null;
        };

        // other functions we might want to implement
        pause = function () {};
        resume = function () {};
        log = function () {};

        // if the first argument is a function then assume the options aren't being passed
        if ($.isFunction(options)) {
            callback = options;
            options = {};
        }

        // Merge passed settings with default values
        var settings = $.extend({}, $.periodic.defaults, {
            ajax_complete : ajaxComplete,
            increment     : increment,
            reset         : reset,
            cancel        : cancel
        }, options);

        // bookkeeping variables
        settings.cur_period = settings.period;
        settings.tid = false;
        var prev_ajax_response = '';

        run();

        // return settings so user can tweak them externally
        return settings;
    };

    $.periodic.defaults = {
        period       : 4000,      // 4 sec.
        max_period   : 1800000,   // 30 min.
        decay        : 1.5,       // time period multiplier
        on_max       : undefined  // called if max_period is reached
    };

    return $.periodic;
});