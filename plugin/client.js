window.__ModuleLoader__.load({
  id: 'dsh-workspace-download',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'workspace-download';
    const MAX_RECENT = 24;
    const MAX_FILES = 400;
    const MAX_TOTAL_BYTES = 64 * 1024 * 1024;
    const MAX_FILE_BYTES = 32 * 1024 * 1024;
    /** Host window cap (dsh-api-workspace-files maxBytes, default 2 MiB). Asking for more is refused, not shortened. */
    const READ_WINDOW = 2 * 1024 * 1024;
    const MAX_DEPTH = 24;
    /** How many oversize names the result report spells out before it only counts them. */
    const MAX_REPORTED_TOO_LARGE = 4;
    const HEAVY = {
      node_modules: true, '.git': true, '.cache': true, '.pnpm-store': true,
      dist: true, build: true, coverage: true, '.next': true, target: true,
      __pycache__: true, '.turbo': true, '.venv': true, venv: true,
      '.dsh-module-fallback': true,
    };

    const CRC_TABLE = (function () {
      const table = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        table[n] = c >>> 0;
      }
      return table;
    })();

    const zh = {
      header: '下载工作区文件',
      title: '下载工作区到本机',
      close: '关闭',
      noWorkspace: '当前会话没有工作区',
      hint: '顶部是本会话刚写入、编辑或交付的文件，可直接勾选。下面仍可浏览整个工作区。只选中一个文件时直接下载该文件本身，选多个才打包成 zip；单次上限约 64MB / 400 个文件，单个文件不超过 32MB；默认跳过 node_modules、.git 等大目录。文件会进浏览器自己的下载目录，不是 DSH 工作区。',
      includeHeavy: '包含 node_modules / .git 等大目录',
      recent: '最近出现',
      recentEmpty: '本会话还没有写入、编辑或交付文件。',
      workspace: '工作区',
      loading: '正在读取…',
      emptyDir: '这个目录是空的。',
      loadFailed: '读取失败',
      retry: '重试',
      truncated: '还有更多条目没有列出。',
      downloadAll: '下载整个工作区',
      downloadSelected: '下载选中项',
      packing: '正在打包…',
      saved: '已交给浏览器下载',
      savedAs: '文件名 {name}，{count} 个文件，{size}。',
      savedAsFile: '文件名 {name}，{size}。',
      manualSave: '浏览器拦截了自动下载，请点此保存',
      limitFiles: '已达到单次 {count} 个文件的上限，压缩包里只包含前面的文件。',
      limitTotal: '已达到单次总量上限 {size}，压缩包里只包含前面的文件。',
      skippedHeavy: '跳过了 {count} 个大目录里的条目。',
      skippedOther: '另有 {count} 个条目因类型不支持被跳过。',
      skippedTooLarge: '跳过了 {name}：{size}，超过单文件上限 {limit}。',
      skippedTooLargeMore: '另有 {count} 个文件也因超过单文件上限被跳过。',
      errorsMore: '另有 {count} 个条目读取失败。',
      packFailed: '打包失败',
      tooLarge: '{name} 有 {size}，超过单文件上限 {limit}。',
      downloadFile: '下载这个文件',
      emptySelection: '选中的项目里没有可以打包的文件。',
    };
    const en = {
      header: 'Download workspace files',
      title: 'Download workspace',
      close: 'Close',
      noWorkspace: 'This session has no workspace',
      hint: 'The top lists files written, edited, or delivered in this session. Browse the rest of the workspace below. A single selected file downloads as itself; several are packed into a zip. One download holds about 64MB or 400 files, with at most 32MB per file, and skips node_modules, .git, and similar large directories. Files go to the browser\'s download folder, not the DSH workspace.',
      includeHeavy: 'Include node_modules, .git, and other large directories',
      recent: 'Recent',
      recentEmpty: 'Nothing has been written, edited, or delivered in this session yet.',
      workspace: 'Workspace',
      loading: 'Loading…',
      emptyDir: 'This directory is empty.',
      loadFailed: 'Could not read this directory',
      retry: 'Retry',
      truncated: 'More entries were not listed.',
      downloadAll: 'Download entire workspace',
      downloadSelected: 'Download selection',
      packing: 'Packing…',
      saved: 'Handed to the browser',
      savedAs: '{name}, {count} files, {size}.',
      savedAsFile: '{name}, {size}.',
      manualSave: 'The browser blocked the automatic download. Save it here',
      limitFiles: 'The limit of {count} files was reached, so the archive holds only the first files.',
      limitTotal: 'The {size} total limit was reached, so the archive holds only the first files.',
      skippedHeavy: 'Skipped {count} entries inside large directories.',
      skippedOther: 'Skipped {count} more entries because their type is not supported.',
      skippedTooLarge: 'Skipped {name}: {size}, above the {limit} per-file limit.',
      skippedTooLargeMore: 'Skipped {count} more files that were above the per-file limit.',
      errorsMore: 'Skipped {count} more entries that could not be read.',
      packFailed: 'Packing failed',
      tooLarge: '{name} is {size}, above the {limit} per-file limit.',
      downloadFile: 'Download this file',
      emptySelection: 'Nothing in the selection could be packed.',
    };

    function fill(template, values) {
      return template.replace(/\{(\w+)\}/g, function (_, key) {
        return values[key] === undefined ? '' : String(values[key]);
      });
    }

    function formatSize(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function messageOf(error) {
      if (typeof error === 'string' && error) return error;
      if (error && typeof error.message === 'string' && error.message) return error.message;
      if (error && typeof error.code === 'string' && error.code) return error.code;
      return 'unexpected error';
    }

    /**
     * The remote client returns { ok, value } and reports failure as { ok:false, error }
     * instead of throwing. Reading the envelope as the payload made every directory look
     * empty and every file look missing, which surfaced as "nothing to download".
     */
    async function callFile(method, args) {
      const result = await method.apply(null, args);
      if (result && result.ok === false) {
        const failure = result.error || {};
        const error = new Error(typeof failure.message === 'string' && failure.message ? failure.message : 'request failed');
        if (typeof failure.code === 'string') error.code = failure.code;
        throw error;
      }
      if (result && result.ok === true && Object.prototype.hasOwnProperty.call(result, 'value')) return result.value;
      return result;
    }

    function normalize(value) {
      return String(value || '').replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
    }

    function parentOf(rel) {
      const clean = normalize(rel);
      const slash = clean.lastIndexOf('/');
      return slash < 0 ? '' : clean.slice(0, slash);
    }

    function baseName(rel) {
      const clean = normalize(rel);
      const slash = clean.lastIndexOf('/');
      return slash < 0 ? clean : clean.slice(slash + 1);
    }

    function safeName(value) {
      const text = String(value || '').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
      return text || 'workspace';
    }

    function withinRoot(root, absolute) {
      const base = String(root || '').replace(/\\/g, '/').replace(/\/+$/, '');
      const path = String(absolute || '').replace(/\\/g, '/');
      if (!base) return null;
      if (path === base) return '';
      if (path.indexOf(base + '/') === 0) return path.slice(base.length + 1);
      return null;
    }

    /** list and readBytes both reject an empty path; the root is the workspace cwd. */
    function absolutePath(root, rel) {
      const base = String(root || '').replace(/\\/g, '/').replace(/\/+$/, '');
      const child = String(rel || '').replace(/\\/g, '/').replace(/^\/+/, '');
      if (!base) return child;
      return child ? base + '/' + child : base;
    }

    function pathFromArgs(args, root) {
      if (!args || typeof args.text !== 'function') return '';
      const direct = args.text('file_path') || args.text('path') || '';
      const relative = withinRoot(root, direct);
      if (relative !== null && relative !== '') return relative;
      if (direct && direct.charAt(0) !== '/' && !/^[A-Za-z]:/.test(direct)) return normalize(direct);
      const files = args.value ? args.value('files') : undefined;
      if (Array.isArray(files)) {
        for (let i = 0; i < files.length; i++) {
          const item = files[i];
          const candidate = item && typeof item.path === 'string' ? item.path : '';
          const found = withinRoot(root, candidate);
          if (found) return found;
          if (candidate && candidate.charAt(0) !== '/') return normalize(candidate);
        }
      }
      return '';
    }

    function collectCalls(blocks, sink) {
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        if (!block) continue;
        sink.push(block);
        if (Array.isArray(block.subCalls)) collectCalls(block.subCalls, sink);
      }
    }

    function recentFromSnapshot(snapshot, root) {
      const found = [];
      const seen = {};
      if (!snapshot) return found;
      const blocks = [];
      const nodes = snapshot.eventNodes || [];
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i] && nodes[i].kind === 'tool-result') blocks.push(nodes[i]);
      }
      collectCalls(snapshot.runningCalls || [], blocks);
      for (let i = blocks.length - 1; i >= 0 && found.length < MAX_RECENT; i--) {
        const block = blocks[i];
        const name = block.name;
        if (name !== 'write' && name !== 'edit' && name !== 'present') continue;
        const rel = pathFromArgs(block.args, root);
        if (!rel || seen[rel]) continue;
        seen[rel] = true;
        found.push({ path: rel, name: baseName(rel), tool: name });
      }
      return found;
    }

    function crc32(bytes) {
      let c = 0xffffffff;
      for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
      return (c ^ 0xffffffff) >>> 0;
    }

    function u16(n) { return new Uint8Array([n & 255, (n >>> 8) & 255]); }
    function u32(n) {
      return new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);
    }

    function concat(chunks) {
      let total = 0;
      for (let i = 0; i < chunks.length; i++) total += chunks[i].length;
      const out = new Uint8Array(total);
      let offset = 0;
      for (let i = 0; i < chunks.length; i++) {
        out.set(chunks[i], offset);
        offset += chunks[i].length;
      }
      return out;
    }

    function buildZip(files) {
      const encoder = new TextEncoder();
      const locals = [];
      const centrals = [];
      let offset = 0;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const nameBytes = encoder.encode(file.name);
        const crc = crc32(file.data);
        const size = file.data.length;
        locals.push(concat([
          u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
          u32(crc), u32(size), u32(size), u16(nameBytes.length), u16(0), nameBytes, file.data,
        ]));
        centrals.push(concat([
          u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
          u32(crc), u32(size), u32(size), u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0),
          u32(0), u32(offset), nameBytes,
        ]));
        offset += locals[locals.length - 1].length;
      }
      const centralDir = concat(centrals);
      return concat(locals.concat([centralDir, concat([
        u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
        u32(centralDir.length), u32(offset), u16(0),
      ])]));
    }

    /** Extensions worth telling the browser about; anything else saves as a generic binary. */
    const MIME = {
      pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp',
      html: 'text/html', htm: 'text/html', css: 'text/css', js: 'text/javascript',
      json: 'application/json', txt: 'text/plain', md: 'text/markdown', log: 'text/plain',
      csv: 'text/csv', tsv: 'text/tab-separated-values', xml: 'application/xml',
      yml: 'text/yaml', yaml: 'text/yaml', py: 'text/x-python', sh: 'text/x-shellscript',
      v: 'text/plain', sv: 'text/plain', vh: 'text/plain', vcd: 'text/plain', fst: 'application/octet-stream',
      zip: 'application/zip', gz: 'application/gzip', tar: 'application/x-tar',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    };

    function mimeOf(name) {
      const dot = String(name || '').lastIndexOf('.');
      if (dot < 0) return 'application/octet-stream';
      const known = MIME[name.slice(dot + 1).toLowerCase()];
      return known || 'application/octet-stream';
    }

    function triggerBrowserSave(bytes, filename, mime) {
      const blob = new Blob([bytes], { type: mime || 'application/octet-stream' });
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = filename;
      anchor.click();
      setTimeout(function () { URL.revokeObjectURL(href); }, 60000);
      return href;
    }

    function tooLargeError(file, size) {
      const error = new Error('too large to download');
      error.code = 'too-large';
      error.file = file;
      error.size = size;
      return error;
    }

    function emptySelectionError() {
      const error = new Error('nothing to download');
      error.code = 'empty-selection';
      return error;
    }

    /** Save one file straight to the browser: same read path, no archive around it. */
    async function downloadOne(files, sessionId, absolutePath, signal) {
      let stat = null;
      try { stat = await callFile(files.stat, [sessionId, absolutePath, signal]); } catch (error) { stat = null; }
      const name = safeFileName(baseName(absolutePath));
      if (stat && typeof stat.bytes === 'number' && stat.bytes > MAX_FILE_BYTES) throw tooLargeError(name, stat.bytes);
      const read = await readFileBytes(files, sessionId, absolutePath, signal);
      if (!read.eof || read.data.length > MAX_FILE_BYTES) throw tooLargeError(name, read.data.length);
      if (read.data.length === 0) throw emptySelectionError();
      triggerBrowserSave(read.data, name, mimeOf(name));
      return { name: name, bytes: read.data.length };
    }

    function minimizePaths(paths) {
      const sorted = paths.map(normalize).filter(function (path) { return path.length > 0; }).sort();
      const out = [];
      for (let i = 0; i < sorted.length; i++) {
        const path = sorted[i];
        let covered = false;
        for (let j = 0; j < out.length; j++) {
          if (path === out[j] || path.indexOf(out[j] + '/') === 0) { covered = true; break; }
        }
        if (!covered) out.push(path);
      }
      return out;
    }

    /** A name the browser accepts as a download, without mangling non-ASCII characters. */
    function safeFileName(value) {
      const text = String(value || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').replace(/^\.+/, '').trim();
      return text || 'workspace.zip';
    }

    /** The directory levels every packed entry shares; dropping them keeps the archive flat. */
    function commonDirOf(entries) {
      if (entries.length === 0) return '';
      let prefix = parentOf(entries[0].name);
      for (let i = 1; i < entries.length && prefix; i++) {
        const dir = parentOf(entries[i].name);
        while (prefix && dir !== prefix && dir.indexOf(prefix + '/') !== 0) {
          const slash = prefix.lastIndexOf('/');
          prefix = slash < 0 ? '' : prefix.slice(0, slash);
        }
      }
      return prefix;
    }

    function flattenEntries(entries, prefix) {
      const taken = {};
      const out = [];
      for (let i = 0; i < entries.length; i++) {
        const full = entries[i].name;
        const trimmed = prefix && full.indexOf(prefix + '/') === 0 ? full.slice(prefix.length + 1) : full;
        let name = trimmed || baseName(full);
        if (taken[name] !== undefined) {
          taken[name] += 1;
          const slash = name.lastIndexOf('.');
          const stem = slash > 0 ? name.slice(0, slash) : name;
          const ext = slash > 0 ? name.slice(slash) : '';
          name = stem + '-' + taken[name] + ext;
        } else {
          taken[name] = 1;
        }
        out.push({ name: name, data: entries[i].data });
      }
      return out;
    }

    /** One selected file is named after itself; groups fall back to their own directory. */
    function archiveNameOf(root, entries, prefix) {
      if (entries.length === 1 && entries[0].name.indexOf('/') < 0) {
        const single = entries[0].name;
        return safeFileName(/\.zip$/i.test(single) ? single : single + '.zip');
      }
      if (prefix) return safeFileName(baseName(prefix) + '.zip');
      return safeFileName((baseName(root) || 'workspace') + '.zip');
    }

    function asBytes(value) {
      if (value instanceof Uint8Array) return value;
      if (value instanceof ArrayBuffer) return new Uint8Array(value);
      if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
      if (Array.isArray(value)) return Uint8Array.from(value);
      return new Uint8Array(0);
    }

    async function readFileBytes(files, sessionId, path, signal) {
      const parts = [];
      let offset = 0;
      let eof = false;
      while (offset <= MAX_FILE_BYTES) {
        // No range: the host returns the whole file when it is within its own cap,
        // and refuses with workspace-file/too-large when it is not. A ranged read is
        // only needed past that cap, and the host rejects any window above it.
        const ranged = { range: { offset: offset, length: READ_WINDOW } };
        let page;
        try {
          page = await callFile(files.readBytes, [sessionId, path, offset === 0 ? {} : ranged, signal]);
        } catch (error) {
          // The host caps one read at 2MB and refuses the whole file past it.
          const text = (error && typeof error.code === 'string' ? error.code : '') + ' ' + messageOf(error);
          if (offset !== 0 || !/too-large/.test(text)) throw error;
          page = await callFile(files.readBytes, [sessionId, path, ranged, signal]);
        }
        const chunk = asBytes(page && page.data);
        parts.push(chunk);
        offset += chunk.length;
        eof = !page || page.eof !== false || chunk.length < READ_WINDOW;
        if (eof) break;
      }
      const data = concat(parts);
      return { data: data, eof: eof && data.length <= MAX_FILE_BYTES };
    }

    async function gather(files, sessionId, root, rel, includeHeavy, budget, signal, depth) {
      if (signal.aborted) return;
      if (depth > MAX_DEPTH) { budget.skippedOther += 1; return; }
      const query = rel ? absolutePath(root, rel) : '.';
      let listing;
      try {
        listing = await callFile(files.list, [sessionId, query, signal]);
      } catch (error) {
        budget.errors.push((rel || query) + ': ' + messageOf(error));
        return;
      }
      const entries = listing && Array.isArray(listing.entries) ? listing.entries : [];
      if (listing && listing.truncated) budget.truncated = true;
      const listed = withinRoot(root, listing && listing.path);
      const base = listed !== null ? listed : normalize(rel);
      for (let i = 0; i < entries.length; i++) {
        if (signal.aborted || budget.stop) return;
        const entry = entries[i];
        const name = entry && typeof entry.name === 'string' ? entry.name : '';
        if (!name || name === '.' || name === '..') continue;
        const child = base ? base + '/' + name : name;
        if (entry.type === 'directory') {
          if (!includeHeavy && HEAVY[name]) { budget.skippedHeavy += 1; continue; }
          await gather(files, sessionId, root, child, includeHeavy, budget, signal, depth + 1);
          continue;
        }
        if (entry.type !== 'file') { budget.skippedOther += 1; continue; }
        const size = typeof entry.size === 'number' ? entry.size : 0;
        if (size > MAX_FILE_BYTES) {
          budget.truncated = true;
          noteTooLarge(budget, child, size);
          continue;
        }
        if (budget.files.length >= MAX_FILES) {
          budget.hitFileCap = true;
          budget.stop = true;
          budget.truncated = true;
          return;
        }
        if (budget.bytes + size > MAX_TOTAL_BYTES) {
          budget.hitTotalCap = true;
          budget.stop = true;
          budget.truncated = true;
          return;
        }
        try {
          const read = await readFileBytes(files, sessionId, absolutePath(root, child), signal);
          if (!read.eof || read.data.length > MAX_FILE_BYTES) {
            noteTooLarge(budget, child, read.data.length);
            budget.truncated = true;
            continue;
          }
          budget.files.push({ name: child, data: read.data });
          budget.bytes += read.data.length;
        } catch (error) {
          budget.errors.push(child + ': ' + messageOf(error));
        }
      }
    }

    /** Keep the first few oversize names for the report, then just count them. */
    function noteTooLarge(budget, file, size) {
      if (budget.tooLarge.length < MAX_REPORTED_TOO_LARGE) budget.tooLarge.push({ file: file, size: size });
      else budget.tooLargeMore += 1;
    }

    async function packSelection(files, sessionId, root, paths, includeHeavy, signal) {
      const budget = {
        files: [], bytes: 0, skippedHeavy: 0, skippedOther: 0, truncated: false, stop: false, errors: [],
        tooLarge: [], tooLargeMore: 0, hitFileCap: false, hitTotalCap: false,
      };
      const targets = minimizePaths(paths);
      if (targets.length === 0) {
        await gather(files, sessionId, root, '', includeHeavy, budget, signal, 0);
      } else {
        for (let i = 0; i < targets.length; i++) {
          if (budget.stop || signal.aborted) break;
          const target = targets[i];
          const query = absolutePath(root, target);
          let stat = null;
          try { stat = await callFile(files.stat, [sessionId, query, signal]); } catch (error) { stat = null; }
          const isFile = !!(stat && typeof stat.absolutePath === 'string');
          if (isFile) {
            if (stat.bytes > MAX_FILE_BYTES) {
              budget.truncated = true;
              noteTooLarge(budget, target, stat.bytes);
              continue;
            }
            if (budget.files.length >= MAX_FILES) {
              budget.hitFileCap = true;
              budget.truncated = true;
              continue;
            }
            if (budget.bytes + stat.bytes > MAX_TOTAL_BYTES) {
              budget.hitTotalCap = true;
              budget.truncated = true;
              continue;
            }
            try {
              const read = await readFileBytes(files, sessionId, query, signal);
              if (!read.eof) { budget.truncated = true; noteTooLarge(budget, target, read.data.length); continue; }
              budget.files.push({ name: target, data: read.data });
              budget.bytes += read.data.length;
            } catch (error) {
              budget.errors.push(target + ': ' + messageOf(error));
            }
          } else {
            await gather(files, sessionId, root, target, includeHeavy, budget, signal, 0);
          }
        }
      }
      if (signal.aborted) throw new Error('aborted');
      if (budget.files.length === 0) {
        if (budget.errors.length > 0) throw new Error(budget.errors[0]);
        if (budget.tooLarge.length > 0) throw tooLargeError(budget.tooLarge[0].file, budget.tooLarge[0].size);
        throw emptySelectionError();
      }
      const prefix = commonDirOf(budget.files);
      const entries = flattenEntries(budget.files, prefix);
      // One file downloads as itself; only a group needs an archive around it.
      const single = entries.length === 1 ? entries[0] : null;
      return {
        bytes: single ? single.data : buildZip(entries),
        archive: single ? safeFileName(single.name) : archiveNameOf(root, entries, prefix),
        direct: single !== null,
        fileCount: entries.length,
        total: budget.bytes,
        truncated: budget.truncated,
        hitFileCap: budget.hitFileCap,
        hitTotalCap: budget.hitTotalCap,
        skippedHeavy: budget.skippedHeavy,
        skippedOther: budget.skippedOther,
        skippedTooLarge: budget.tooLarge,
        tooLargeMore: budget.tooLargeMore,
        errors: budget.errors.slice(0, MAX_REPORTED_TOO_LARGE),
        errorsMore: Math.max(0, budget.errors.length - MAX_REPORTED_TOO_LARGE),
      };
    }

    const STYLE_TEXT = ".wsdl-button{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;margin:0;padding:0;border:0;border-radius:7px;background:transparent;color:var(--fg-muted,#8b8d93);cursor:pointer}\n.wsdl-button:hover{background:var(--bg-hover,rgba(127,127,127,.14));color:var(--fg,#e8e8e8)}\n.wsdl-button svg{width:16px;height:16px;display:block}\n.wsdl-backdrop{position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);padding:24px}\n.wsdl-modal{display:flex;flex-direction:column;width:min(640px,100%);max-height:min(78vh,720px);overflow:hidden;border:1px solid var(--border,#34363c);border-radius:12px;background:var(--bg,#1c1e22);color:var(--fg,#e8e8e8);box-shadow:0 18px 60px rgba(0,0,0,.4)}\n.wsdl-head,.wsdl-row{display:flex;align-items:center;gap:8px}\n.wsdl-head{justify-content:space-between;padding:14px 16px 8px}\n.wsdl-title{font-size:15px;font-weight:650}\n.wsdl-close{border:0;background:transparent;color:inherit;font-size:20px;line-height:1;cursor:pointer}\n.wsdl-cwd,.wsdl-hint,.wsdl-note{padding:0 16px 8px;color:var(--fg-muted,#9aa0a6);font-size:12px;line-height:1.5}\n.wsdl-cwd{font-family:ui-monospace,monospace;word-break:break-all}\n.wsdl-heavy{display:flex;align-items:center;gap:8px;padding:0 16px 10px;font-size:13px}\n.wsdl-scroll{flex:1;min-height:0;overflow:auto;padding:0 8px 8px}\n.wsdl-section{margin:8px 8px 4px;color:var(--fg-muted,#9aa0a6);font-size:11px;font-weight:650;letter-spacing:.04em;text-transform:uppercase}\n.wsdl-row{min-height:30px;padding:2px 8px;border-radius:7px}\n.wsdl-row:hover{background:var(--bg-hover,rgba(127,127,127,.1))}\n.wsdl-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}\n.wsdl-meta{color:var(--fg-muted,#9aa0a6);font-size:11px}\n.wsdl-toggle{width:18px;border:0;background:transparent;color:inherit;cursor:pointer}\n.wsdl-children{padding-left:18px}\n.wsdl-actions{display:flex;justify-content:flex-end;gap:8px;padding:10px 16px 14px;border-top:1px solid var(--border,#34363c)}\n.wsdl-actions button,.wsdl-link{border:1px solid var(--border,#4a4d55);border-radius:8px;background:var(--bg-elevated,#2a2d33);color:inherit;padding:6px 10px;font-size:13px;cursor:pointer;text-decoration:none}\n.wsdl-actions button:disabled{opacity:.5;cursor:default}\n.wsdl-status{padding:0 16px 8px;font-size:12px}\n.wsdl-error{color:var(--danger,#e06c75)}\n.wsdl-doc-action{display:inline-flex;align-items:center;gap:6px;min-width:0}\n.wsdl-doc-note{color:var(--fg-muted,#9aa0a6);font-size:11px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}";

    function DownloadIcon() {
      return h('svg', { viewBox: '0 0 16 16', 'aria-hidden': true },
        h('path', { d: 'M8 1.5v8', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' }),
        h('path', { d: 'M4.5 7 8 10.5 11.5 7', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' }),
        h('path', { d: 'M3 13h10', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' }));
    }

    function HeaderButton(props) {
      const t = props.t;
      const snap = props.store(function (state) { return state; });
      return h(React.Fragment, null,
        h('button', {
          type: 'button',
          className: 'wsdl-button',
          title: t('header'),
          'aria-label': t('header'),
          'aria-expanded': !!snap.open,
          onClick: function () { props.store.set({ open: !snap.open }); },
        }, h(DownloadIcon)),
        snap.open ? h(Dialog, props) : null);
    }

    /** Right-pane header button: save the file the preview is showing. */
    function DocumentDownloadAction(props) {
      const t = props.t;
      const [busy, setBusy] = React.useState(false);
      const [note, setNote] = React.useState('');
      React.useEffect(function () {
        if (!note) return undefined;
        const timer = setTimeout(function () { setNote(''); }, 6000);
        return function () { clearTimeout(timer); };
      }, [note]);
      const path = props.absolutePath;
      const sessionId = props.sessionId;
      if (!path || !sessionId) return null;
      function run() {
        if (busy) return;
        setBusy(true);
        setNote('');
        downloadOne(props.files, sessionId, path).then(function (saved) {
          setBusy(false);
          setNote(fill(t('savedAsFile'), { name: saved.name, size: formatSize(saved.bytes) }));
        }, function (error) {
          setBusy(false);
          if (error && error.code === 'too-large') setNote(fill(t('tooLarge'), { name: error.file, size: formatSize(error.size), limit: formatSize(MAX_FILE_BYTES) }));
          else setNote(messageOf(error));
        });
      }
      return h('span', { className: 'wsdl-doc-action' },
        h('button', {
          type: 'button',
          className: 'wsdl-button',
          title: t('downloadFile'),
          'aria-label': t('downloadFile'),
          disabled: busy,
          onClick: run,
        }, h(DownloadIcon)),
        note ? h('span', { className: 'wsdl-doc-note', title: note }, note) : null);
    }

    function EntryRow(props) {
      const entry = props.entry;
      const rel = props.base ? props.base + '/' + entry.name : entry.name;
      const directory = entry.type === 'directory' || entry.type === 'symlink';
      const level = props.levels[rel];
      return h('div', null,
        h('div', { className: 'wsdl-row' },
          directory
            ? h('button', { type: 'button', className: 'wsdl-toggle', onClick: function () { props.onToggleDir(rel); }, 'aria-label': entry.name }, props.expanded[rel] ? '▾' : '▸')
            : h('span', { className: 'wsdl-toggle' }),
          h('input', { type: 'checkbox', checked: !!props.selected[rel], onChange: function () { props.onToggleSelect(rel); }, 'aria-label': entry.name }),
          h('span', { className: 'wsdl-name', title: rel }, entry.name),
          typeof entry.size === 'number' ? h('span', { className: 'wsdl-meta' }, formatSize(entry.size)) : null),
        directory && props.expanded[rel] ? h(Level, Object.assign({}, props, { rel: rel, level: level })) : null);
    }

    function Level(props) {
      const level = props.level;
      if (!level || level.status === 'loading') return h('div', { className: 'wsdl-note' }, props.t('loading'));
      if (level.status === 'error') {
        return h('div', { className: 'wsdl-note' }, props.t('loadFailed') + '：' + level.error, ' ',
          h('button', { type: 'button', className: 'wsdl-link', onClick: function () { props.onReload(props.rel); } }, props.t('retry')));
      }
      const entries = level.entries || [];
      return h('div', { className: props.rel ? 'wsdl-children' : '' },
        entries.length === 0 ? h('div', { className: 'wsdl-note' }, props.t('emptyDir') + (level.queried ? '（' + level.queried + '）' : '')) : entries.map(function (entry) {
          return h(EntryRow, Object.assign({}, props, { key: entry.name, entry: entry, base: props.rel }));
        }),
        level.truncated ? h('div', { className: 'wsdl-note' }, props.t('truncated')) : null);
    }

    function Dialog(props) {
      const t = props.t;
      const snap = props.store(function (state) { return state; });
      const sessionId = props.sessionId;
      const root = props.useSessions(function (sessions) {
        const row = sessions && sessions.byId ? sessions.byId[sessionId] : null;
        return row && typeof row.cwd === 'string' ? row.cwd : '';
      });
      const recent = props.useTrajectory(function (snapshot) { return recentFromSnapshot(snapshot, root); });
      const [levels, setLevels] = React.useState({});
      const [expanded, setExpanded] = React.useState({});
      const [selected, setSelected] = React.useState({});
      const [includeHeavy, setIncludeHeavy] = React.useState(false);
      const request = React.useRef(0);

      function load(rel) {
        const token = ++request.current;
        setLevels(function (prev) { return Object.assign({}, prev, { [rel]: { status: 'loading', entries: [] } }); });
        // '.' is a real path the host accepts and resolves to the workspace root;
        // '' is refused outright, and a stale absolute cwd can resolve somewhere else.
        callFile(props.files.list, [sessionId, rel ? absolutePath(root, rel) : '.']).then(function (listing) {
          if (request.current !== token && rel === '') return;
          const got = listing && Array.isArray(listing.entries) ? listing.entries : [];
          setLevels(function (prev) {
            return Object.assign({}, prev, { [rel]: { status: 'ready', entries: got, truncated: !!(listing && listing.truncated), queried: rel ? absolutePath(root, rel) : '.' } });
          });
        }, function (error) {
          setLevels(function (prev) { return Object.assign({}, prev, { [rel]: { status: 'error', error: messageOf(error), entries: [] } }); });
        });
      }

      React.useEffect(function () {
        if (!snap.open || !sessionId || !root) return undefined;
        setLevels({});
        setExpanded({});
        setSelected({});
        load('');
        return function () { request.current += 1; };
      }, [snap.open, sessionId, root]);

      function close() { props.store.set({ open: false }); }
      function toggleDir(rel) {
        setExpanded(function (prev) { const next = Object.assign({}, prev); next[rel] = !prev[rel]; return next; });
        if (!levels[rel]) load(rel);
      }
      function toggleSelect(rel) {
        setSelected(function (prev) {
          const next = Object.assign({}, prev);
          if (next[rel]) delete next[rel];
          else next[rel] = true;
          return next;
        });
      }
      function download(whole) {
        const paths = whole ? [] : Object.keys(selected);
        const controller = new AbortController();
        props.store.set({ status: 'busy', error: '', result: null });
        packSelection(props.files, sessionId, root, paths, includeHeavy, controller.signal).then(function (packed) {
          const filename = packed.archive;
          const mime = packed.direct ? mimeOf(filename) : 'application/zip';
          const href = triggerBrowserSave(packed.bytes, filename, mime);
          props.store.set({
            status: 'ready', error: '',
            result: {
              filename: filename, href: href, direct: packed.direct,
              fileCount: packed.fileCount, bytes: packed.total,
              truncated: packed.truncated, hitFileCap: packed.hitFileCap, hitTotalCap: packed.hitTotalCap,
              skippedHeavy: packed.skippedHeavy, skippedOther: packed.skippedOther,
              skippedTooLarge: packed.skippedTooLarge, tooLargeMore: packed.tooLargeMore,
              errors: packed.errors, errorsMore: packed.errorsMore,
            },
          });
        }, function (error) {
          let text = messageOf(error);
          if (error && error.code === 'too-large') text = fill(t('tooLarge'), { name: error.file, size: formatSize(error.size), limit: formatSize(MAX_FILE_BYTES) });
          else if (error && error.code === 'empty-selection') text = t('emptySelection');
          props.store.set({ status: 'error', error: text, result: null });
        });
      }

      const busy = snap.status === 'busy';
      const result = snap.result;
      const selectedCount = Object.keys(selected).length;
      return h('div', { className: 'wsdl-backdrop', onClick: close },
        h('div', { className: 'wsdl-modal', role: 'dialog', 'aria-modal': true, 'aria-label': t('title'), onClick: function (event) { event.stopPropagation(); } },
          h('div', { className: 'wsdl-head' },
            h('div', { className: 'wsdl-title' }, t('title')),
            h('button', { type: 'button', className: 'wsdl-close', onClick: close, 'aria-label': t('close') }, '×')),
          h('div', { className: 'wsdl-cwd' }, root || t('noWorkspace')),
          h('div', { className: 'wsdl-hint' }, t('hint')),
          h('label', { className: 'wsdl-heavy' },
            h('input', { type: 'checkbox', checked: includeHeavy, onChange: function (event) { setIncludeHeavy(event.target.checked); } }),
            t('includeHeavy')),
          h('div', { className: 'wsdl-scroll' },
            h('div', { className: 'wsdl-section' }, t('recent')),
            recent.length === 0 ? h('div', { className: 'wsdl-note' }, t('recentEmpty')) : recent.map(function (item) {
              return h('div', { className: 'wsdl-row', key: item.path },
                h('span', { className: 'wsdl-toggle' }),
                h('input', { type: 'checkbox', checked: !!selected[item.path], onChange: function () { toggleSelect(item.path); }, 'aria-label': item.path }),
                h('span', { className: 'wsdl-name', title: item.path }, item.path),
                h('span', { className: 'wsdl-meta' }, item.tool));
            }),
            h('div', { className: 'wsdl-section' }, t('workspace')),
            root ? h(Level, {
              rel: '', level: levels[''], levels: levels, expanded: expanded, selected: selected, t: t,
              onToggleDir: toggleDir, onToggleSelect: toggleSelect, onReload: load,
            }) : h('div', { className: 'wsdl-note' }, t('noWorkspace'))),
          snap.error ? h('div', { className: 'wsdl-status wsdl-error' }, t('packFailed') + '：' + snap.error) : null,
          result ? h('div', { className: 'wsdl-status' },
            t('saved'), ' ',
            result.direct
              ? fill(t('savedAsFile'), { name: result.filename, size: formatSize(result.bytes) })
              : fill(t('savedAs'), { name: result.filename, count: result.fileCount, size: formatSize(result.bytes) }),
            ' ',
            result.href ? h('a', { className: 'wsdl-link', href: result.href, download: result.filename }, t('manualSave')) : null,
            result.hitFileCap ? h('div', null, fill(t('limitFiles'), { count: MAX_FILES })) : null,
            result.hitTotalCap ? h('div', null, fill(t('limitTotal'), { size: formatSize(MAX_TOTAL_BYTES) })) : null,
            (result.skippedTooLarge || []).map(function (item) {
              return h('div', { key: 'too-large-' + item.file }, fill(t('skippedTooLarge'), { name: item.file, size: formatSize(item.size), limit: formatSize(MAX_FILE_BYTES) }));
            }),
            result.tooLargeMore ? h('div', null, fill(t('skippedTooLargeMore'), { count: result.tooLargeMore })) : null,
            result.skippedHeavy ? h('div', null, fill(t('skippedHeavy'), { count: result.skippedHeavy })) : null,
            result.skippedOther ? h('div', null, fill(t('skippedOther'), { count: result.skippedOther })) : null,
            result.truncated && !result.hitFileCap && !result.hitTotalCap && !result.tooLargeMore
              && !(result.skippedTooLarge || []).length && !(result.errors || []).length && !result.skippedOther
              ? h('div', null, t('truncated')) : null,
            (result.errors || []).map(function (line) {
              return h('div', { key: 'err-' + line, className: 'wsdl-error' }, line);
            }),
            result.errorsMore ? h('div', null, fill(t('errorsMore'), { count: result.errorsMore })) : null) : null,
          h('div', { className: 'wsdl-actions' },
            h('button', { type: 'button', disabled: busy || !root, onClick: function () { download(true); } }, busy ? t('packing') : t('downloadAll')),
            h('button', { type: 'button', disabled: busy || !root || selectedCount === 0, onClick: function () { download(false); } }, t('downloadSelected') + (selectedCount ? ' (' + selectedCount + ')' : '')))));
    }

    return {
      inject: ['slots', 'locale', 'remote', 'remote.workspaceFiles'],
      apply(ctx) {
        ctx.effect(function () { return ctx.locale.register(NS, { zh: zh, en: en }); });
        ctx.effect(function () {
          const node = document.createElement('style');
          node.textContent = STYLE_TEXT;
          document.head.appendChild(node);
          return function () { node.remove(); };
        });
        const translate = ctx.locale.bind(NS);
        const store = { open: false, status: 'idle', error: '', result: null };
        let current = store;
        const listeners = new Set();
        function publish(next) {
          current = next;
          listeners.forEach(function (listener) { listener(); });
        }
        const useStore = function (select) {
          return React.useSyncExternalStore(function (listener) {
            listeners.add(listener);
            return function () { listeners.delete(listener); };
          }, function () { return select(current); }, function () { return select(current); });
        };
        useStore.set = function (patch) { publish(Object.assign({}, current, patch)); };
        const files = ctx.remote.workspaceFiles;

        const slots = ctx.slots;
        // The document preview already resolved the file's Host path; this button
        // saves that exact file, so a previewed PDF needs no trip through the dialog.
        ctx.effect(function () {
          return slots.inject('sidebar.right.tab.document.actions', function () {
            return slots.register({
              name: 'sidebar.right.tab.document.actions',
              id: 'workspace-download',
              order: 20,
              locale: NS,
            }, function (props) {
              return h(DocumentDownloadAction, {
                t: props.t || translate,
                absolutePath: props.absolutePath,
                sessionId: props.sessionId,
                files: files,
              });
            });
          });
        });

        ctx.effect(function () {
          return slots.inject('conversation.session.header.utilities', function () {
            return slots.register({
              name: 'conversation.session.header.utilities',
              id: 'workspace-download',
              order: 20,
              locale: NS,
            }, function (props) {
              return h(HeaderButton, {
                t: translate,
                store: useStore,
                sessionId: props.sessionId,
                useSessions: props.useSessions,
                useTrajectory: props.useTrajectory,
                files: files,
              });
            });
          });
        });
      },
    };
  },
});
