/**
 * Created by root on 4/11/18.
 */

enum ExamplesForm {
   PLAIN = 'plain',
   COMPLEX = 'complex'
}

export type VerbInfo = [FrameID, Info, PCEDTExamples]

export type FrameID = string

export type Info = [FrameInfo, Notes, Examples]

export type Notes = Array<string>

export type Examples = Array<string>

export type FrameInfo = Array<any>

export type PCEDTExamples = Array<string>

type NumResults = string

export type VerbAndInfo = [Verb, Array<VerbInfo>]

export type CompleteVerbAndInfo = Array<VerbAndInfo>

export type Verb = string

export interface EngVallexResponseData {
   status: {
       status:string;
   };
   inputParameters: {
       Verb:string;
       pairsLimit:number;
       examplesForm:ExamplesForm;
       examplesLimit:string;
   };
   result: [
       NumResults,
       CompleteVerbAndInfo
   ]

}
