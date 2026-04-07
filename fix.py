import re

def resolve_file():
    with open('src/app/production/page.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # Define the replacements manually to avoid index issues
    # Conflict 2 (Header block)
    block_2_head = """<<<<<<< HEAD
            <div className="flex items-center justify-center gap-4 w-full md:w-auto">
              <Button variant="ghost" size="icon" onClick={() => setCalendarMonth(new Date(currentYear, calendarMonth.getMonth() - 1, 1))}><ChevronLeft className="h-6 w-6" /></Button>
              <h2 className="text-xl font-bold text-slate-800 w-32 text-center">{currentYear}年 {currentMonthStr}月</h2>
              <Button variant="ghost" size="icon" onClick={() => setCalendarMonth(new Date(currentYear, calendarMonth.getMonth() + 1, 1))}><ChevronRight className="h-6 w-6" /></Button>
=======
          <div className="flex items-center justify-center gap-4 w-full md:w-auto">
            <Button variant="ghost" size="icon" onClick={() => setCalendarMonth(new Date(currentYear, calendarMonth.getMonth() - 1, 1))}><ChevronLeft className="h-6 w-6" /></Button>
            <h2 className="text-xl font-bold text-slate-800 w-32 text-center">{currentYear}年 {currentMonthStr}月</h2>
            <Button variant="ghost" size="icon" onClick={() => setCalendarMonth(new Date(currentYear, calendarMonth.getMonth() + 1, 1))}><ChevronRight className="h-6 w-6" /></Button>
          </div>

          <div className="flex gap-2 w-full md:w-auto justify-end">
            {canEdit && <Button onClick={() => openEventDialog()} className="bg-slate-700 hover:bg-slate-800 text-white gap-1 font-bold shadow-sm flex-1 md:flex-none"><Flag className="h-4 w-4" /> イベント<span className="hidden sm:inline">登録</span></Button>}
            <Button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white gap-1 font-bold shadow-sm flex-1 md:flex-none"><Printer className="h-4 w-4" /> 印刷</Button>
          </div>
        </div>

        <div className="hidden print:flex justify-between items-end mb-3 border-b-2 border-black pb-2">
          <div className="text-2xl font-black">製造・出荷スケジュール表 ({currentYear}年 {currentMonthStr}月)</div>
          <div className="text-sm font-bold text-slate-800">更新日: {todayStr}</div>
        </div>

        <div className="border border-slate-300 rounded-lg md:rounded-sm overflow-hidden print:border-black print:border-2 flex flex-col">

          <div className="hidden md:block print:block">
            <div className="grid grid-cols-7 bg-slate-100 print:bg-gray-100 border-b border-slate-300 print:border-black">
              {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (<div key={d} className={`p-2 text-center font-bold text-sm border-r border-slate-300 print:border-black last:border-r-0 ${i === 0 ? 'text-red-600' : i === 6 ? 'text-blue-600' : 'text-slate-700 print:text-black'}`}>{d}</div>))}
>>>>>>> f9c00e30820e55e83ad46ebcb3d836829e8a6370"""
    block_2_clean = """            <div className="flex items-center justify-center gap-4 w-full md:w-auto">
              <Button variant="ghost" size="icon" onClick={() => setCalendarMonth(new Date(currentYear, calendarMonth.getMonth() - 1, 1))}><ChevronLeft className="h-6 w-6" /></Button>
              <h2 className="text-xl font-bold text-slate-800 w-32 text-center">{currentYear}年 {currentMonthStr}月</h2>
              <Button variant="ghost" size="icon" onClick={() => setCalendarMonth(new Date(currentYear, calendarMonth.getMonth() + 1, 1))}><ChevronRight className="h-6 w-6" /></Button>
            </div>
            <div className="flex gap-2 w-full md:w-auto justify-end">
              {canEdit && <Button onClick={(e) => openEventDialog(e)} className="bg-slate-700 hover:bg-slate-800 text-white gap-1 font-bold shadow-sm flex-1 md:flex-none"><Flag className="h-4 w-4" /> イベント<span className="hidden sm:inline">登録</span></Button>}
              <Button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white gap-1 font-bold shadow-sm flex-1 md:flex-none"><Printer className="h-4 w-4" /> 印刷</Button>
            </div>
          </div>
        <div className="hidden print:flex justify-between items-end mb-3 border-b-2 border-black pb-2">
          <div className="text-2xl font-black">製造・出荷スケジュール表 ({currentYear}年 {currentMonthStr}月)</div>
          <div className="text-sm font-bold text-slate-800">更新日: {todayStr}</div>
        </div>
        <div className="border border-slate-300 rounded-lg md:rounded-sm overflow-hidden print:border-black print:border-2 flex flex-col">
          <div className="hidden md:block print:block">
            <div className="grid grid-cols-7 bg-slate-100 print:bg-gray-100 border-b border-slate-300 print:border-black">
              {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (<div key={d} className={`p-2 text-center font-bold text-sm border-r border-slate-300 print:border-black last:border-r-0 ${i === 0 ? 'text-red-600' : i === 6 ? 'text-blue-600' : 'text-slate-700 print:text-black'}`}>{d}</div>))}"""

    if block_2_head in content:
        content = content.replace(block_2_head, block_2_clean)

    # Replace the rest dynamically
    pattern = re.compile(r'<<<<<<< HEAD\n(.*?)\n=======\n(.*?)\n>>>>>>> f9c00e30820e55e83ad46ebcb3d836829e8a6370\n', re.DOTALL)
    
    match_list = list(pattern.finditer(content))
    # We apply HEAD for block 3 (mobile lists) and Remote for block 4, 5, 6
    while match_list:
        m = match_list[0]
        # Custom logic based on the content of the block
        if "dayEvents.map(ev => (" in m.group(1):
            # This is the mobile calendar block. HEAD is right because of min-h-12 and proper event binding
            content = content[:m.start()] + m.group(1) + "\n" + content[m.end():]
        elif "未計画の残数がある受注" in m.group(1):
            # HEAD is right because we want the list view structure before dialog extraction
            content = content[:m.start()] + m.group(1) + "\n" + content[m.end():]
        elif "table" in m.group(1).lower() and "TableRow" in m.group(1):
            # It's the table vs the list creation card. We want HEAD
            content = content[:m.start()] + m.group(1) + "\n" + content[m.end():]
        elif "各種モーダル (共通で配置し" in m.group(1):
            # It's the modal part. HEAD has inline modals, Remote has {renderAllDialogs()}
            content = content[:m.start()] + m.group(1) + "\n" + content[m.end():]
        else:
            # When in doubt, prefer HEAD for now, as I've manually adjusted some things.
            content = content[:m.start()] + m.group(1) + "\n" + content[m.end():]
            
        match_list = list(pattern.finditer(content))

    with open('src/app/production/page.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

resolve_file()
