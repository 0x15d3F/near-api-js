"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
async function exponentialBackoff(startWaitTime, retryNumber, waitBackoff, getResult) {
    // TODO: jitter?
    let waitTime = startWaitTime;
    for (let i = 0; i < retryNumber; i++) {
        const result = await getResult();
        if (result) {
            return result;
        }
        // console.log('result', result, getResult.toString());
        await sleep(waitTime);
        waitTime *= waitBackoff;
        i++;
    }
    return null;
}
exports.default = exponentialBackoff;
// Sleep given number of millis.
function sleep(millis) {
    return new Promise(resolve => setTimeout(resolve, millis));
}