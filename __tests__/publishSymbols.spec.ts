import { downloadSymbolClient, getSymbolClientVersion, getSymbolServiceUri, runSymbolCommand, unpublishSymbols, unzipSymbolClient, updateSymbolClient } from "../src/publishSymbols";
const fs = require('fs');
import * as tc from '@actions/tool-cache';
import * as core from '@actions/core';
import * as io from '@actions/io';
import axios from 'axios';
import * as exec from '@actions/exec';

describe('Publish Symbol Unit Tests', () => {
    let symbolServiceUrl = "https://testUrl.com";
    let directory = "C:\\Users\\Directory\\";

    beforeEach(async() => {
        jest.mock('@actions/core');
        jest.spyOn(core, 'debug');
        jest.spyOn(core, 'info');
        jest.spyOn(core, 'isDebug').mockReturnValue(true);
    });

    it('downloadSymbolClient successful When file does not exist previously', async () => {
        // Arrange
        jest.mock('fs');
        jest.spyOn(fs, 'existsSync');
        fs.existsSync.mockReturnValue(false);
        jest.mock('@actions/tool-cache');
        const spy = jest.spyOn(tc, 'downloadTool');
        spy.mockResolvedValue("test.zip");

        // Act
        var symbolPath = await downloadSymbolClient(symbolServiceUrl, directory)

        // Assert
        expect(tc.downloadTool).toHaveBeenCalled();
        expect(symbolPath).not.toBeNull();
    });

    it('downloadSymbolClient successful When file exists already', async () => {
        // Arrange
        jest.mock('fs');
        jest.spyOn(fs, 'existsSync');
        fs.existsSync.mockReturnValue(true);
        jest.mock('@actions/io');
        jest.spyOn(io, 'rmRF');
        jest.mock('@actions/tool-cache');
        const spy = jest.spyOn(tc, 'downloadTool');
        spy.mockResolvedValue("test.zip");

        // Act
        var symbolPath = await downloadSymbolClient(symbolServiceUrl, directory);

        // Assert
        expect(tc.downloadTool).toHaveBeenCalled();
        expect(io.rmRF).toHaveBeenCalled();
        expect(symbolPath).not.toBeNull();
    });

    it('getSymbolClientVersion successful', async () => {
        // Arrange
        jest.mock('axios');
        var axiosSpy = jest.spyOn(axios, 'head');
        var response = {
            headers: {
                'symbol-client-version': '1.0.0'
            }
        };
        axiosSpy.mockResolvedValue(response);

        // Act
        var versionHeader = await getSymbolClientVersion(symbolServiceUrl);

        // Assert
        expect(axios.head).toHaveBeenCalled();
        expect(versionHeader).toBe('1.0.0');
    });

    it('runSymbolCommand successful', async () => {
        // Arrange
        jest.mock('@actions/exec');
        jest.spyOn(exec, 'exec').mockResolvedValue(0);

        // Act
        await runSymbolCommand("C:\\assemblyPath", "args");

        // Assert
        expect(exec.exec).toHaveBeenCalled();
    });

    it('runSymbolCommand throws Error', async () => {
        // Arrange
        jest.mock('@actions/exec');
        const execSpy = jest.spyOn(exec, 'exec');
        execSpy.mockResolvedValue(200);

        // Act
        try {
            await runSymbolCommand("C:\\assemblyPath", "args");
        }catch(ex) {
            expect(ex.message).toBe("C:\\assemblyPath\\symbol.exe exited with code 200");
        }

        // Assert
        expect(exec.exec).toHaveBeenCalled();
    });

    it('unzipSymbolClient successful - File did not exist earlier', async () => {
        // Arrange
        jest.mock('fs');
        jest.spyOn(fs, 'existsSync');
        fs.existsSync.mockReturnValue(false);
        jest.mock('@actions/io');
        jest.spyOn(io, 'mkdirP');
        jest.spyOn(tc, 'extractZip');

        // Act
        await unzipSymbolClient("clientZip.zip", "C:\\destination");

        // Assert
        expect(io.mkdirP).toHaveBeenCalled();
        expect(io.rmRF).not.toHaveBeenCalled();
        expect(tc.extractZip).toHaveBeenCalled();
    });

    it('unzipSymbolClient successful - File exists already', async () => {
        // Arrange
        jest.mock('fs');
        jest.spyOn(fs, 'existsSync');
        fs.existsSync.mockReturnValue(true);
        jest.mock('@actions/io');
        jest.spyOn(io, 'mkdirP');
        jest.spyOn(io, 'rmRF');
        jest.spyOn(tc, 'extractZip');

        // Act
        await unzipSymbolClient("clientZip.zip", "C:\\destination");

        // Assert
        expect(io.mkdirP).toHaveBeenCalled();
        expect(io.rmRF).toHaveBeenCalled();
        expect(tc.extractZip).toHaveBeenCalled();
    });

    it('updateSymbolClient successful', async () => {
        // Arrange
        jest.mock('axios');
        var axiosSpy = jest.spyOn(axios, 'head');
        var response = {
            headers: {
                'symbol-client-version': '1.0.0'
            }
        };
        axiosSpy.mockResolvedValue(response);

        jest.mock('fs');
        jest.spyOn(fs, 'existsSync');
        fs.existsSync.mockReturnValue(false);

        jest.mock('@actions/io');
        jest.spyOn(io, 'rmRF');
        jest.spyOn(io, 'mkdirP');

        jest.mock('@actions/tool-cache');
        const spy = jest.spyOn(tc, 'downloadTool');
        spy.mockResolvedValue("test.zip");
        jest.spyOn(tc, 'extractZip');
        jest.spyOn(tc, 'cacheDir');

        // Act
        var toolPath = await updateSymbolClient(symbolServiceUrl);

        // Assert
        expect(toolPath).toBe("C:\\Users\\taghos\\source\\github\\action-publish-symbols\\__tests__\\CACHE\\SymbolClient\\1.0.0\\x64\\lib\\net45");
    });

    it('updateSymbolClient successful - Explicit Version from cache', async () => {
        // Arrange
        jest.mock('axios');
        var axiosSpy = jest.spyOn(axios, 'head');
        var response = {
            headers: {
                'symbol-client-version': '1.0.0'
            }
        };
        axiosSpy.mockResolvedValue(response);

        jest.mock('fs');
        jest.spyOn(fs, 'existsSync');
        fs.existsSync.mockReturnValue(true);

        // Act
        var toolPath = await updateSymbolClient(symbolServiceUrl);

        // Assert
        expect(toolPath).toBe("C:\\Users\\taghos\\source\\github\\action-publish-symbols\\__tests__\\CACHE\\SymbolClient\\1.0.0\\x64\\lib\\net45");
    });

    it('unpublishSymbols successful', async () => {
        // Act
        unpublishSymbols("share", "tran-1234");

        // Assert
        expect(core.debug).toHaveBeenCalled();
        expect(core.info).toHaveBeenCalled();
    });

    it('getSymbolServiceUri successful', async () => {
        // Arrange
        jest.mock('axios');
        var axiosSpy = jest.spyOn(axios, 'get');
        var response = {
            status: 200,
            data: {
                locationMappings: [
                    {
                        location: "https://artifacts.dev.azure.com"
                    }
                ]
            }
        };
        axiosSpy.mockResolvedValue(response);

        // Act
        var artifactUri = await getSymbolServiceUri("https://collection.microsoft.com", "patToken");

        // Assert
        expect(artifactUri).toBe('https://artifacts.dev.azure.com');

    });

    it('getSymbolServiceUri failure', async () => {
        // Arrange
        jest.mock('axios');
        var axiosSpy = jest.spyOn(axios, 'get');
        var response = {
            status: 500
        };
        axiosSpy.mockResolvedValue(response);

        // Act
        var artifactUri = await getSymbolServiceUri("https://collection.microsoft.com", "patToken");

        // Assert
        expect(artifactUri).toBe('');
    });
});