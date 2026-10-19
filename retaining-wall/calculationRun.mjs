// UI lifecycle only. A returned callback may have queued legacy work, so only
// the adapter's actual result/error state completes a calculation.
export function createCalculationRun({calculate,onStart,onFinish,onError,schedule=task=>setTimeout(task,100)}){
  let active=false,callbackReturned=false,terminalOutcome=null;
  function finish(outcome){if(!active)return;active=false;onFinish(outcome);}
  return {
    get active(){return active;},
    start(){
      if(active)return false;
      active=true;callbackReturned=false;terminalOutcome=null;
      try{
        onStart();
        schedule(async()=>{
          try{await calculate();}
          catch(error){onError(error);terminalOutcome='error';}
          finally{callbackReturned=true;if(terminalOutcome)finish(terminalOutcome);}
        });
      }catch(error){onError(error);finish('error');}
      return true;
    },
    observe({state,ready,running}){
      if(!active)return;
      if(running){terminalOutcome=null;return;}
      if(state==='ERROR')terminalOutcome='error';
      else if(ready)terminalOutcome='complete';
      if(callbackReturned&&terminalOutcome)finish(terminalOutcome);
    },
  };
}
