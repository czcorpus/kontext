/**
 * Created by root on 4/11/18.
 */

enum ExamplesForm {
   PLAIN = 'plain',
   COMPLEX = 'complex'
}

type CompleteSense = [Sense, SenseInfoList]

export type Sense = string

export type SenseInfoList = Array<SenseInfo>

export type SenseInfo = [VsourceID, VsourceInfo, VtargetInfoList]

export type VsourceID = string

export type VsourceInfo = Array<any>

export type VtargetInfoList = Array<VtargetInfo>

export type VtargetInfo = Array<Array<any>>

type NumResults = string

export type CompleteSenseList = Array<CompleteSense>

export interface VallexResponseData {
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
       CompleteSenseList
   ]

}
