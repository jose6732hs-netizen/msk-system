(() => {
  'use strict';

  const TAG_HANDSHAKE = '[Handshake]';
  const TAG_PARSING = '[Parsing]';
  const TAG_EXECUTION = '[Execution]';

  function createLogger(logger) {
    if (typeof logger === 'function') {
      return logger;
    }
    return (level, ...args) => {
      const safeLevel = ['debug', 'info', 'warn', 'error'].includes(String(level)) ? level : 'info';
      const method = console[safeLevel] || console.log;
      method(...args);
    };
  }

  function base64ToUint8Array(base64Value) {
    const cleaned = String(base64Value || '')
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .replace(/[^A-Za-z0-9+/=]/g, '');

    const padded = cleaned + '='.repeat((4 - (cleaned.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  function uint8ArrayToHex(value) {
    return Array.from(value)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  function pemToArrayBuffer(pemText) {
    const content = String(pemText || '')
      .replace(/-----BEGIN PUBLIC KEY-----/g, '')
      .replace(/-----END PUBLIC KEY-----/g, '')
      .replace(/-----BEGIN RSA PUBLIC KEY-----/g, '')
      .replace(/-----END RSA PUBLIC KEY-----/g, '')
      .replace(/\s+/g, '');

    if (!content) {
      throw new Error('Chave pública inválida para validação de assinatura.');
    }

    return base64ToUint8Array(content).buffer;
  }

  async function sha256HexFromText(inputText) {
    const encoded = new TextEncoder().encode(String(inputText || ''));
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return uint8ArrayToHex(new Uint8Array(digest));
  }

  async function sha256HexFromBuffer(inputBuffer) {
    const digest = await crypto.subtle.digest('SHA-256', inputBuffer);
    return uint8ArrayToHex(new Uint8Array(digest));
  }

  async function importPublicKey(publicKeyPem) {
    const keyData = pemToArrayBuffer(publicKeyPem);
    try {
      return await crypto.subtle.importKey(
        'spki',
        keyData,
        {
          name: 'RSASSA-PKCS1-v1_5',
          hash: { name: 'SHA-256' },
        },
        false,
        ['verify'],
      );
    } catch (_) {
      return crypto.subtle.importKey(
        'spki',
        keyData,
        {
          name: 'RSASSA-PKCS1-v1_5',
          hash: 'SHA-256',
        },
        false,
        ['verify'],
      );
    }
  }

  function validateManifestContract(manifest) {
    const safe = manifest && typeof manifest === 'object' ? manifest : {};
    const version = String(safe.version || '').trim();
    const bundleUrl = String(safe.bundle_url || '').trim();
    const hashSha256 = String(safe.hash_sha256 || '').trim().toLowerCase();
    const signature = String(safe.signature || '').trim();

    if (!version || !bundleUrl || !hashSha256 || !signature) {
      throw new Error('Manifesto remoto inválido: campos obrigatórios ausentes.');
    }

    if (!/^[a-f0-9]{64}$/i.test(hashSha256)) {
      throw new Error('Manifesto remoto inválido: hash_sha256 fora do padrão esperado.');
    }

    return {
      version,
      bundle_url: bundleUrl,
      hash_sha256: hashSha256,
      signature,
    };
  }

  async function verifyManifestSignature(manifest, publicKeyPem) {
    const key = await importPublicKey(publicKeyPem);
    const payload = `${manifest.version}:${manifest.bundle_url}:${manifest.hash_sha256}`;
    const signatureBytes = base64ToUint8Array(manifest.signature);

    return crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      signatureBytes,
      new TextEncoder().encode(payload),
    );
  }

  async function fetchNoStore(url, expected = 'json') {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });

    if (!response.ok) {
      throw new Error(`Falha HTTP ${response.status} ao consultar ${url}`);
    }

    if (expected === 'text') {
      return response.text();
    }
    return response.json();
  }

  async function fetchAndValidateRuntime({ manifestUrl, publicKeyPem, logger, expectedBundleHost = null } = {}) {
    const log = createLogger(logger);
    const safeManifestUrl = String(manifestUrl || '').trim();
    if (!safeManifestUrl) {
      throw new Error('URL do manifesto remoto não informada.');
    }

    log('info', TAG_HANDSHAKE, 'Solicitando manifesto remoto...', safeManifestUrl);
    const manifestRaw = await fetchNoStore(safeManifestUrl, 'json');
    const manifest = validateManifestContract(manifestRaw);

    if (expectedBundleHost) {
      const host = String(new URL(manifest.bundle_url).hostname || '').toLowerCase();
      const expected = String(expectedBundleHost || '').toLowerCase();
      if (host !== expected) {
        throw new Error(`Host do bundle remoto inválido: ${host}`);
      }
    }

    log('info', TAG_HANDSHAKE, 'Verificando assinatura digital do manifesto...');
    const signatureValid = await verifyManifestSignature(manifest, publicKeyPem);
    if (!signatureValid) {
      throw new Error('Assinatura digital do manifesto inválida.');
    }

    log('info', TAG_HANDSHAKE, 'Baixando bundle remoto...', manifest.bundle_url);
    const bundleResponse = await fetch(manifest.bundle_url, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });

    if (!bundleResponse.ok) {
      throw new Error(`Falha HTTP ${bundleResponse.status} ao baixar bundle remoto.`);
    }

    const bundleBytes = await bundleResponse.arrayBuffer();
    const downloadedHash = await sha256HexFromBuffer(bundleBytes);
    const bundleCode = new TextDecoder('utf-8').decode(bundleBytes);

    if (downloadedHash.toLowerCase() !== manifest.hash_sha256.toLowerCase()) {
      throw new Error('Integridade inválida: hash SHA-256 divergente do manifesto.');
    }

    log('info', TAG_HANDSHAKE, 'Handshake remoto concluído com sucesso.', {
      version: manifest.version,
      bundleUrl: manifest.bundle_url,
      hash: manifest.hash_sha256,
    });

    return {
      manifest,
      bundleCode,
      downloadedHash,
    };
  }

  function createPseudoObject(interpreter) {
    return interpreter.createObject(interpreter.OBJECT);
  }

  function createBridge(interpreter, options = {}) {
    const bridge = createPseudoObject(interpreter);
    const chromeObj = createPseudoObject(interpreter);
    const runtimeObj = createPseudoObject(interpreter);
    const storageObj = createPseudoObject(interpreter);
    const storageLocalObj = createPseudoObject(interpreter);
    const networkObj = createPseudoObject(interpreter);
    const notificationsObj = createPseudoObject(interpreter);

    const logger = createLogger(options.logger);
    const chromeApi = options.chrome || null;
    const notificationsApi = options.notifications || chromeApi?.notifications || null;
    const documentApi = options.document || null;
    const runtimeListenerState = {
      actions: new Set(),
      queue: [],
    };

    const cloneForQueue = (value) => {
      try {
        return JSON.parse(JSON.stringify(value ?? null));
      } catch (_) {
        return { __bridge_raw__: String(value ?? '') };
      }
    };

    if (chromeApi?.runtime?.onMessage?.addListener) {
      chromeApi.runtime.onMessage.addListener((message, sender) => {
        try {
          const action = String(message?.action || '');
          if (!action || !runtimeListenerState.actions.has(action)) {
            return;
          }

          runtimeListenerState.queue.push({
            action,
            message: cloneForQueue(message),
            sender: {
              id: String(sender?.id || ''),
              origin: String(sender?.origin || ''),
              url: String(sender?.url || ''),
            },
            receivedAt: Date.now(),
          });

          if (runtimeListenerState.queue.length > 100) {
            runtimeListenerState.queue.shift();
          }
        } catch (_) {
          // ignora falhas de listener para não quebrar runtime local.
        }
      });
    }

    const logFunction = interpreter.createNativeFunction((level, message) => {
      const safeLevel = String(level || 'info').toLowerCase();
      const safeMessage = String(message || '');
      logger(safeLevel, TAG_EXECUTION, safeMessage);
    }, false);
    interpreter.setProperty(bridge, 'log', logFunction, Interpreter.NONENUMERABLE_DESCRIPTOR);

    const nowFunction = interpreter.createNativeFunction(() => Date.now(), false);
    interpreter.setProperty(bridge, 'now', nowFunction, Interpreter.NONENUMERABLE_DESCRIPTOR);

    const runtimeSendMessage = interpreter.createAsyncFunction((payload, done) => {
      try {
        if (!chromeApi?.runtime?.sendMessage) {
          done(interpreter.nativeToPseudo({ ok: false, error: 'chrome.runtime.sendMessage indisponível.' }));
          return;
        }

        const nativePayload = interpreter.pseudoToNative(payload);
        chromeApi.runtime.sendMessage(nativePayload, (response) => {
          const runtimeError = chromeApi.runtime?.lastError;
          if (runtimeError) {
            done(interpreter.nativeToPseudo({ ok: false, error: String(runtimeError.message || 'Falha de runtime.') }));
            return;
          }
          done(interpreter.nativeToPseudo({ ok: true, response: response ?? null }));
        });
      } catch (error) {
        done(interpreter.nativeToPseudo({ ok: false, error: String(error?.message || error) }));
      }
    });

    const runtimeGetUrl = interpreter.createNativeFunction((path) => {
      if (!chromeApi?.runtime?.getURL) return '';
      return chromeApi.runtime.getURL(String(path || ''));
    }, false);

    const runtimeOnMessageAddListener = interpreter.createNativeFunction((action) => {
      const safeAction = String(action || '').trim();
      if (!safeAction) {
        return interpreter.nativeToPseudo({ ok: false, error: 'action é obrigatório.' });
      }
      runtimeListenerState.actions.add(safeAction);
      return interpreter.nativeToPseudo({ ok: true, action: safeAction });
    }, false);

    const runtimeOnMessageRemoveListener = interpreter.createNativeFunction((action) => {
      const safeAction = String(action || '').trim();
      if (!safeAction) {
        return interpreter.nativeToPseudo({ ok: false, error: 'action é obrigatório.' });
      }
      runtimeListenerState.actions.delete(safeAction);
      return interpreter.nativeToPseudo({ ok: true, action: safeAction });
    }, false);

    const runtimeOnMessagePull = interpreter.createNativeFunction(() => {
      if (!runtimeListenerState.queue.length) {
        return null;
      }
      const next = runtimeListenerState.queue.shift();
      return interpreter.nativeToPseudo(next);
    }, false);

    interpreter.setProperty(runtimeObj, 'sendMessage', runtimeSendMessage, Interpreter.NONENUMERABLE_DESCRIPTOR);
    interpreter.setProperty(runtimeObj, 'getURL', runtimeGetUrl, Interpreter.NONENUMERABLE_DESCRIPTOR);
    interpreter.setProperty(runtimeObj, 'onMessageAddListener', runtimeOnMessageAddListener, Interpreter.NONENUMERABLE_DESCRIPTOR);
    interpreter.setProperty(runtimeObj, 'onMessageRemoveListener', runtimeOnMessageRemoveListener, Interpreter.NONENUMERABLE_DESCRIPTOR);
    interpreter.setProperty(runtimeObj, 'onMessagePull', runtimeOnMessagePull, Interpreter.NONENUMERABLE_DESCRIPTOR);

    const storageGet = interpreter.createAsyncFunction((keys, done) => {
      try {
        if (!chromeApi?.storage?.local?.get) {
          done(interpreter.nativeToPseudo({}));
          return;
        }
        const nativeKeys = interpreter.pseudoToNative(keys);
        chromeApi.storage.local.get(nativeKeys, (result) => {
          done(interpreter.nativeToPseudo(result || {}));
        });
      } catch (_) {
        done(interpreter.nativeToPseudo({}));
      }
    });

    const storageSet = interpreter.createAsyncFunction((payload, done) => {
      try {
        if (!chromeApi?.storage?.local?.set) {
          done(interpreter.nativeToPseudo({ ok: false }));
          return;
        }
        const nativePayload = interpreter.pseudoToNative(payload);
        chromeApi.storage.local.set(nativePayload, () => {
          done(interpreter.nativeToPseudo({ ok: true }));
        });
      } catch (_) {
        done(interpreter.nativeToPseudo({ ok: false }));
      }
    });

    const storageRemove = interpreter.createAsyncFunction((keys, done) => {
      try {
        if (!chromeApi?.storage?.local?.remove) {
          done(interpreter.nativeToPseudo({ ok: false }));
          return;
        }
        const nativeKeys = interpreter.pseudoToNative(keys);
        chromeApi.storage.local.remove(nativeKeys, () => {
          done(interpreter.nativeToPseudo({ ok: true }));
        });
      } catch (_) {
        done(interpreter.nativeToPseudo({ ok: false }));
      }
    });

    interpreter.setProperty(storageLocalObj, 'get', storageGet, Interpreter.NONENUMERABLE_DESCRIPTOR);
    interpreter.setProperty(storageLocalObj, 'set', storageSet, Interpreter.NONENUMERABLE_DESCRIPTOR);
    interpreter.setProperty(storageLocalObj, 'remove', storageRemove, Interpreter.NONENUMERABLE_DESCRIPTOR);
    interpreter.setProperty(storageObj, 'local', storageLocalObj, Interpreter.NONENUMERABLE_DESCRIPTOR);

    const fetchJson = interpreter.createAsyncFunction((url, init, done) => {
      const requestUrl = String(url || '').trim();
      const nativeInit = interpreter.pseudoToNative(init || {});

      Promise.resolve()
        .then(async () => {
          const response = await fetch(requestUrl, {
            ...nativeInit,
            cache: 'no-store',
            headers: {
              ...(nativeInit?.headers || {}),
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              Pragma: 'no-cache',
            },
          });

          let jsonData = null;
          try {
            jsonData = await response.json();
          } catch (_) {
            jsonData = null;
          }

          return {
            ok: response.ok,
            status: response.status,
            data: jsonData,
          };
        })
        .then((result) => done(interpreter.nativeToPseudo(result)))
        .catch((error) => {
          done(interpreter.nativeToPseudo({ ok: false, status: 0, error: String(error?.message || error) }));
        });
    });

    const fetchText = interpreter.createAsyncFunction((url, init, done) => {
      const requestUrl = String(url || '').trim();
      const nativeInit = interpreter.pseudoToNative(init || {});

      Promise.resolve()
        .then(async () => {
          const response = await fetch(requestUrl, {
            ...nativeInit,
            cache: 'no-store',
            headers: {
              ...(nativeInit?.headers || {}),
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              Pragma: 'no-cache',
            },
          });

          const textData = await response.text();
          return {
            ok: response.ok,
            status: response.status,
            text: textData,
          };
        })
        .then((result) => done(interpreter.nativeToPseudo(result)))
        .catch((error) => {
          done(interpreter.nativeToPseudo({ ok: false, status: 0, error: String(error?.message || error) }));
        });
    });

    const getRemoteUiBaseUrl = interpreter.createNativeFunction(() => {
      const configured = String(options.remoteUiBaseUrl || '').trim();
      return configured || 'https://msk-keymaster.lovable.app/ext/runtime/ui';
    }, false);

    interpreter.setProperty(networkObj, 'fetchJson', fetchJson, Interpreter.NONENUMERABLE_DESCRIPTOR);
    interpreter.setProperty(networkObj, 'fetchText', fetchText, Interpreter.NONENUMERABLE_DESCRIPTOR);
    interpreter.setProperty(networkObj, 'getRemoteUiBaseUrl', getRemoteUiBaseUrl, Interpreter.NONENUMERABLE_DESCRIPTOR);

    const notificationCreate = interpreter.createAsyncFunction((optionsPayload, done) => {
      try {
        if (!notificationsApi?.create) {
          done(interpreter.nativeToPseudo({ ok: false, error: 'API de notificações indisponível.' }));
          return;
        }

        const nativeOptions = interpreter.pseudoToNative(optionsPayload || {});
        const optionsSafe = {
          type: 'basic',
          title: String(nativeOptions?.title || 'Infinity Credits'),
          message: String(nativeOptions?.message || 'Evento do runtime remoto.'),
          iconUrl: String(nativeOptions?.iconUrl || 'icons/icon48.png'),
        };

        notificationsApi.create('', optionsSafe, (notificationId) => {
          done(interpreter.nativeToPseudo({ ok: true, id: notificationId || '' }));
        });
      } catch (error) {
        done(interpreter.nativeToPseudo({ ok: false, error: String(error?.message || error) }));
      }
    });
    interpreter.setProperty(notificationsObj, 'create', notificationCreate, Interpreter.NONENUMERABLE_DESCRIPTOR);

    interpreter.setProperty(chromeObj, 'runtime', runtimeObj, Interpreter.NONENUMERABLE_DESCRIPTOR);
    interpreter.setProperty(chromeObj, 'storage', storageObj, Interpreter.NONENUMERABLE_DESCRIPTOR);
    interpreter.setProperty(chromeObj, 'notifications', notificationsObj, Interpreter.NONENUMERABLE_DESCRIPTOR);

    interpreter.setProperty(bridge, 'chrome', chromeObj, Interpreter.NONENUMERABLE_DESCRIPTOR);
    interpreter.setProperty(bridge, 'network', networkObj, Interpreter.NONENUMERABLE_DESCRIPTOR);
    interpreter.setProperty(bridge, 'notifications', notificationsObj, Interpreter.NONENUMERABLE_DESCRIPTOR);

    if (documentApi) {
      const uiObj = createPseudoObject(interpreter);

      const setStatus = interpreter.createNativeFunction((text) => {
        const statusEl = documentApi.querySelector('#loaderStatus');
        if (statusEl) statusEl.textContent = String(text || '');
      }, false);

      const setVisible = interpreter.createNativeFunction((selector, visible) => {
        const el = documentApi.querySelector(String(selector || ''));
        if (!el) return;
        el.style.display = visible ? '' : 'none';
      }, false);

      const setText = interpreter.createNativeFunction((selector, text) => {
        const el = documentApi.querySelector(String(selector || ''));
        if (!el) return;
        el.textContent = String(text || '');
      }, false);

      const renderHtml = interpreter.createNativeFunction((html) => {
        const host = documentApi.querySelector('#runtimeRoot');
        if (host) {
          host.innerHTML = String(html || '');
        }
      }, false);

      const openSupport = interpreter.createNativeFunction(() => {
        if (typeof options.openExternalUrl === 'function') {
          options.openExternalUrl('https://chat.whatsapp.com/HcF04iHn3rbIWvXdCoxJLb');
        }
      }, false);

      interpreter.setProperty(uiObj, 'setStatus', setStatus, Interpreter.NONENUMERABLE_DESCRIPTOR);
      interpreter.setProperty(uiObj, 'setVisible', setVisible, Interpreter.NONENUMERABLE_DESCRIPTOR);
      interpreter.setProperty(uiObj, 'setText', setText, Interpreter.NONENUMERABLE_DESCRIPTOR);
      interpreter.setProperty(uiObj, 'renderHtml', renderHtml, Interpreter.NONENUMERABLE_DESCRIPTOR);
      interpreter.setProperty(uiObj, 'openSupportWhatsapp', openSupport, Interpreter.NONENUMERABLE_DESCRIPTOR);

      interpreter.setProperty(bridge, 'ui', uiObj, Interpreter.NONENUMERABLE_DESCRIPTOR);
    }

    return {
      bridge,
      chromeObj,
    };
  }

  function pumpInterpreter(interpreter) {
    return new Promise((resolve, reject) => {
      let totalSteps = 0;
      const MAX_INTERPRETER_STEPS = 3000000;

      const cycle = () => {
        try {
          const status = interpreter.getStatus();
          if (status === Interpreter.Status.DONE) {
            resolve();
            return;
          }

          if (status === Interpreter.Status.ASYNC || status === Interpreter.Status.TASK) {
            setTimeout(cycle, 15);
            return;
          }

          let localSteps = 0;
          while (localSteps < 4000 && interpreter.getStatus() === Interpreter.Status.STEP) {
            interpreter.step();
            localSteps += 1;
            totalSteps += 1;
            if (totalSteps > MAX_INTERPRETER_STEPS) {
              throw new Error('Execução interrompida por limite de segurança de steps.');
            }
          }

          setTimeout(cycle, 0);
        } catch (error) {
          reject(error);
        }
      };

      cycle();
    });
  }

  async function executeBundle({
    bundleCode,
    contextName,
    entrypoint,
    bridgeOptions,
    logger,
  } = {}) {
    const log = createLogger(logger);
    const safeBundle = String(bundleCode || '');
    const safeEntrypoint = String(entrypoint || '').trim();

    if (!safeBundle.trim()) {
      throw new Error('Bundle remoto vazio.');
    }
    if (!safeEntrypoint) {
      throw new Error('Entrypoint do runtime não informado.');
    }
    if (!globalThis.acorn || !globalThis.Interpreter) {
      throw new Error('Dependências locais ausentes: acorn.js e interpreter.js são obrigatórios.');
    }

    log('info', TAG_PARSING, 'Iniciando parsing do bundle remoto...');
    globalThis.acorn.parse(safeBundle, { ecmaVersion: 5 });

    const invocation = `\n;if (typeof RuntimeEntry !== 'object' || !RuntimeEntry) { throw new Error('RuntimeEntry ausente no bundle remoto.'); }\nif (typeof RuntimeEntry['${safeEntrypoint}'] !== 'function') { throw new Error('Entrypoint ${safeEntrypoint} ausente no RuntimeEntry.'); }\nRuntimeEntry['${safeEntrypoint}']();\n`;
    const script = `${safeBundle}${invocation}`;

    log('info', TAG_EXECUTION, `Executando bundle no sandbox (${contextName})...`);
    const interpreter = new Interpreter(script, (intr, globalObj) => {
      const bridgePayload = createBridge(intr, bridgeOptions || {});
      const runtimeContext = intr.nativeToPseudo({
        contextName: String(contextName || ''),
        startedAt: Date.now(),
      });

      const consoleObj = createPseudoObject(intr);
      const consoleLog = intr.createNativeFunction((message) => {
        log('info', TAG_EXECUTION, String(message || ''));
      }, false);
      const consoleWarn = intr.createNativeFunction((message) => {
        log('warn', TAG_EXECUTION, String(message || ''));
      }, false);
      const consoleError = intr.createNativeFunction((message) => {
        log('error', TAG_EXECUTION, String(message || ''));
      }, false);

      intr.setProperty(consoleObj, 'log', consoleLog, Interpreter.NONENUMERABLE_DESCRIPTOR);
      intr.setProperty(consoleObj, 'warn', consoleWarn, Interpreter.NONENUMERABLE_DESCRIPTOR);
      intr.setProperty(consoleObj, 'error', consoleError, Interpreter.NONENUMERABLE_DESCRIPTOR);

      intr.setProperty(globalObj, 'Bridge', bridgePayload.bridge, Interpreter.NONENUMERABLE_DESCRIPTOR);
      intr.setProperty(globalObj, 'chrome', bridgePayload.chromeObj, Interpreter.NONENUMERABLE_DESCRIPTOR);
      intr.setProperty(globalObj, 'RuntimeContext', runtimeContext, Interpreter.NONENUMERABLE_DESCRIPTOR);
      intr.setProperty(globalObj, 'console', consoleObj, Interpreter.NONENUMERABLE_DESCRIPTOR);
    });

    await pumpInterpreter(interpreter);
    log('info', TAG_EXECUTION, `Runtime remoto executado com sucesso (${contextName}).`);
  }

  globalThis.RuntimeSecureLoader = {
    fetchAndValidateRuntime,
    executeBundle,
    sha256HexFromText,
  };
})();
