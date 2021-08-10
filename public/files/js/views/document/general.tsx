/*
 * Copyright (c) 2015 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2015 Tomas Machalek <tomas.machalek@gmail.com>
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
import * as CoreViews from '../../types/coreViews';

// ------------------------------ <ImgWithMouseover /> -----------------------------

export const ImgWithMouseover:React.FC<CoreViews.ImgWithMouseover.Props> = (props) => {

    const [currState, changeState] = React.useState({isMouseover: false});

    const handleCloseMouseover = () => {
        changeState({isMouseover: true});
    };

    const handleCloseMouseout = () => {
        changeState({isMouseover: false});
    };

    const mkAltSrc = (s) => {
        const tmp = s.split('.');
        return `${tmp.slice(0, -1).join('.')}_s.${tmp[tmp.length - 1]}`;
    }

    const css = {...props.style};
    if (props.clickHandler) {
        css['cursor'] = 'pointer';
    }

    const src2 = props.src2 ? props.src2 : mkAltSrc(props.src);
    return <img className={props.htmlClass}
                src={currState.isMouseover ? src2 : props.src}
                onClick={props.clickHandler}
                alt={props.alt}
                title={props.alt}
                style={css}
                onMouseOver={handleCloseMouseover}
                onMouseOut={handleCloseMouseout}  />;
};

