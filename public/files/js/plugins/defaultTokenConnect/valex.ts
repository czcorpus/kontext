/**
 * Created by root on 4/11/18.
 */

enum ExamplesForm {
   PLAIN = 'plain',
   COMPLEX = 'complex'
}

type NumResults = string;

type WordPair = string;

type Frame = [WordPair, FrameInfo];

type FrameId = string;

type FrameInfo = [FrameId, any];


type Functors = string;

export interface ValexResponseData {
   status: {
       status:string;
   };
   inputParameters: {
       language:string;
       sourceVerb:string;
       targetVerb:string;
       pairsLimit:number;
       examplesForm:ExamplesForm;
       examplesLimit:string;
   };
   result: [
       NumResults,
       Array<Frame>
   ]

}
