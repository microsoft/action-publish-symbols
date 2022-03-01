import * as hlp from '../src/helpers'

test('test getTempPath', async () => {
    let tempPath = hlp.getTempPath()
    expect(tempPath.length).toBeGreaterThan(0)    
})

test('test getTempFileName', async () => {
    let tempFileName = hlp.getTempFileName()
    expect(tempFileName.length).toBeGreaterThan(0)    
})