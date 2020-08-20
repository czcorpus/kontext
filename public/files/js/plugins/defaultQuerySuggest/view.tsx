/*
 * Copyright (c) 2020 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2020 Tomas Machalek <tomas.machalek@gmail.com>
 * Copyright (c) 2020 Martin Zimandl <martin.zimandl@gmail.com>
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

import * as React from 'react';
import { Kontext } from '../../types/common';
import { IActionDispatcher } from 'kombo';
import { List } from 'cnc-tskit';
import { Model } from './model';



export enum KnownRenderers {
    BASIC = 'basic',
    ERROR = 'error',
    UNSUPPORTED = 'unsupported'
}


export interface BasicRendererProps {
    data:Array<string>;
}

export interface ErrorRendererProps {
    data:Error|string;
}

export interface UnsupportedRendererProps {
    data:unknown;
}


export interface SuggestionsViews {
    [KnownRenderers.BASIC]:React.SFC<BasicRendererProps>;
    [KnownRenderers.ERROR]:React.SFC<ErrorRendererProps>;
    [KnownRenderers.UNSUPPORTED]:React.SFC<UnsupportedRendererProps>;
}


export function init(dispatcher:IActionDispatcher, model:Model, he:Kontext.ComponentHelpers):SuggestionsViews {


    const UnsupportedRenderer:React.SFC<UnsupportedRendererProps> = (props) => {
        return <div className="suggestion-box">Unsupported renderer (TODO)</div>
    }

    // ------------- <ErrorRenderer /> -------------------------------

    const ErrorRenderer:React.SFC<ErrorRendererProps> = (props) => {
        return <div className="ErrorRenderer">
            <p>
                <img className="error-icon"
                        src={he.createStaticUrl('img/error-icon.svg')}
                        alt={he.translate('global__error_icon')} />
                {he.translate('defaultTD__failed_to_fetch_external_information')}.

            </p>
            <p className="gear">
                <img src={he.createStaticUrl('img/gear.svg')} alt={he.translate('defaultTD__plug_in_error_symbol_alt')}
                        style={{width: '3em'}} title={`${props.data}`} />
            </p>
        </div>
    };

    // --------------QueryFormModelState <BasicRenderer /> ------------------------------

    const BasicRenderer:React.SFC<BasicRendererProps> = (props) => {
        return <div className="BasicRenderer">
            <ul>
                {List.map(
                    (item, index) => <li key={index}>{item}</li>,
                    props.data
                )}
            </ul>
        </div>
    };

    return {
        [KnownRenderers.BASIC]: BasicRenderer,
        [KnownRenderers.ERROR]: ErrorRenderer,
        [KnownRenderers.UNSUPPORTED]: UnsupportedRenderer
    }

}