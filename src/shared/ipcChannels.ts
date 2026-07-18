export const IPC = {
  ptyCreate: 'pty:create',
  ptyWrite: 'pty:write',
  ptyResize: 'pty:resize',
  ptyKill: 'pty:kill',
  ptyData: 'pty:data',
  ptyExit: 'pty:exit',
  ptyTitle: 'pty:title',
  ptyCwd: 'pty:cwd',
  menuNewTab: 'menu:new-tab',
  menuClose: 'menu:close',
  menuSelectTab: 'menu:select-tab',
  menuSplitRight: 'menu:split-right',
  menuSplitDown: 'menu:split-down'
} as const
