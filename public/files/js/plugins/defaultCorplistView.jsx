/*
 * Copyright (c) 2015 Institute of the Czech National Corpus
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; version 2
 * dated June, 1991.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.

 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

define(['vendor/react', 'jquery'], function (React, $) {
    'use strict';

    var lib = {};

    lib.filterFactory = function (dispatcher, mixins) {

        // <span className="keyword current" data-keyword-id="$c[0]">$c[1]</span>

        var KeywordLink = React.createClass({
            render: function () {
                return (
                    <a className="keyword" href="corplist?keyword={this.props.keyword}"
                       data-keyword-id="{this.props.keywordId}">{this.props.label}</a>
                );
            }
        });

        var KeywordsField = React.createClass({
            getInitialState: function () {
                return {};
            },
            render: function () {
                var links = this.props.keywords.map(function (keyword, i) {
                    return <KeywordLink keyword="foo" keywordId="bar" />;
                });

                return (
                    <fieldset className="keywords">
                        <legend>$_('Labels')</legend>
                        <a className="keyword reset" href="corplist">- $_('none') -</a>
                        {links}
                    </fieldset>
                );
            }
        });

        var OtherPropertiesField = React.createClass({
            render: function () {
                return (
                    <fieldset>
                        #for $k in $keywords
                        <input type="hidden" name="keyword" value="$k"/>
                        #end for
                        <legend>$_('Filter')</legend>
                        $_('size from'): <input className="min-max" type="text" name="min_size" value="$form.min_size"/>
                        $_('to'): <input className="min-max" type="text" name="max_size" value="$form.max_size"/>
                        <button type="submit" className="default-button">$_('Apply filter')</button>
                    </fieldset>
                );
            }
        });

        return React.createClass({
            render: function () {
                var data = ['a', 'b', 'c'];  // TODO - testing
                return (
                    <div>
                        <KeywordsField keywords={data} />
                        <OtherPropertiesField />
                    </div>
                )
            }
        });


    };

    return lib;
});