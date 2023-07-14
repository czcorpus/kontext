/*
 * Copyright (c) 2021 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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

import styled from 'styled-components';
import * as theme from '../../views/theme/default';


export const SubcmixerWidget = styled.div`

    div.controls {
        margin-top: 1em;

        .desc {
            font-size: 1.4em;

            .icon {
                width: 1em;
                margin-right: 0.4em;
                vertical-align: middle;
            }
        }
    }

    input.num.disabled {
        color: ${theme.colorLightText};
    }

    .checked, .crossed {
        font-size: 120%;
        font-weight: bold;
        padding-left: 0.2em;
        padding-right: 0.2em;
        color: ${theme.colorWhitelikeBlue};
        border-radius: ${theme.inputBorderRadius};
    }

    .checked {
        background-color: ${theme.colorLogoBlue};
    }

    .crossed {
        background-color: ${theme.colorLogoOrange};
    }

    p.attr-warning {
        img.warning {
            width: 1em;
            display: inline-block;
            margin-right: 0.2em;
        }
    }

    .ucnkSyntaxViewer_ValueShare {

        img.warning {
            display: inline-block;
            margin-right: 0.3em;
            width: 1em;
            vertical-align: middle;

        }
    }
`;

export const MixerTrigger = styled.div`
    
    display: inline;

    a.trigger img {
        width: 1.5em;
        vertical-align: middle;
    }
`;