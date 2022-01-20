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

import * as Kontext from '../../types/kontext';
import * as CoreViews from '../../types/coreViews';
import * as S from './style';



export interface ScreenProps {
    isMobile:boolean;
    innerWidth:number;
    innerHeight:number;
}


export function init(
    he:Kontext.ComponentHelpers
):React.ComponentClass<CoreViews.ResponsiveWrapper.Props> {

    // --------- <ResponsiveWrapper /> ----------------------------------------------

    class ResponsiveWrapper extends React.Component<CoreViews.ResponsiveWrapper.Props,
    {
        width:number;
        height:number;
        frameWidth:number;
        frameHeight:number;
    }> {

        private readonly ref:React.RefObject<HTMLDivElement>;

        constructor(props) {
            super(props);
            this.state = {
                width: 1,
                height: 1,
                frameWidth: 1,
                frameHeight: 1
            };
            this.ref = React.createRef();
            this.handleWindowResize = this.handleWindowResize.bind(this);
            he.getWindowResizeStream().subscribe(this.handleWindowResize);
        }

        private calcAndSetSizes():void {
            if (this.ref.current) {
                const cellWidthFract = this.props.widthFract ?? 1;
                const maxHeightPortion = cellWidthFract > 2 ? 0.25 : 0.32;
                const newWidth = this.ref.current.getBoundingClientRect().width;
                const newHeight = this.ref.current.getBoundingClientRect().height;
                this.setState({
                    width: newWidth,
                    height: newHeight < window.innerHeight * maxHeightPortion ? newHeight : window.innerHeight * maxHeightPortion,
                    frameWidth: window.innerWidth,
                    frameHeight: window.innerHeight
                });
            }
        }

        componentDidMount() {
            this.calcAndSetSizes();
        }

        private handleWindowResize(props:ScreenProps) {
            this.calcAndSetSizes();
        }

        render() {
            return (
                <S.ResponsiveWrapper minWidth={this.props.minWidth} ref={this.ref}>
                    {this.props.render(this.state.width, this.state.height)}
                </S.ResponsiveWrapper>
            );
        }

    }

    return ResponsiveWrapper;
}