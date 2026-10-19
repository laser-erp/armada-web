/* АРМАДА store: state / persist / PocketBase (phase2 chunk B) */
const DEFAULT_VEHICLES=[
  {plate:"О 535 МВ 198",consumptionPer100Km:20,payloadTons:5,bodyLengthM:6,bodyWidthM:2.4,bodyHeightM:2.2},
  {plate:"М 277 НО 198",consumptionPer100Km:20,payloadTons:5,bodyLengthM:6,bodyWidthM:2.4,bodyHeightM:2.2},
  {plate:"В 603 СА 47",consumptionPer100Km:20,payloadTons:10,bodyLengthM:8,bodyWidthM:2.45,bodyHeightM:2.5,makeModel:"ГАЗ 33104 Валдай"}
];
/** Регламент по руководству ГАЗ-33104 «Валдай» (ММЗ): ТО-1 10 тыс. км, ТО-2 20 тыс. км, СО раз в год. */
/** Современные аналоги (что брать в магазине) ↔ старые названия из руководства. */
const GAZ_33104_BUY={
  gear:"Лукойл ТМ-5 85W-90 API GL-5 или Газпромнефть Super T-3 / GL-5 80W-90; зимой — GL-5 75W-90",
  litol:"Литол-24 в тубе (Oilright, VMPAUTO, Газпромнефть) или любая литиевая NLGI-2",
  solidol:"Солидол Ж/С или тот же Литол-24 (NLGI-2)",
  shock:"АЖ-12Т (Oilright) или жидкость для амортизаторов",
  gur:"ATF Dexron II/III (Лукойл ATF, Mobil ATF 220); очень холодно — ВМГЗ",
  brake:"Тормозная DOT-4: РосДот-4, Felix DOT-4, Castrol DOT-4",
  cool:"ОЖ-40 / Тосол А-40М или готовый антифриз G11 (−40)",
  motor:"Дизель 15W-40 или 10W-40 API CI-4/CH-4/CF-4 (Лукойл, Газпромнефть, Shell Rimula)"
};
/** Табл. 2.4 — карта смазки: buy = что купить сегодня; grease = как в руководстве. */
const GAZ_33104_LUBE_TABLE=[
  {point:"Картер КПП", places:"1", amount:"по уровню", buy:GAZ_33104_BUY.gear, grease:"По руководству: «Супер Т-3», «Девон Супер Т», Лукойл ТМ-5 85W-90 (−25…+40 °C); зимой 75W-90"},
  {point:"Подшипники карданных шарниров", places:"3", amount:"~4 г", buy:GAZ_33104_BUY.gear, grease:"По руководству: «Супер Т-3» / Лукойл ТМ-5 85W-90"},
  {point:"Шлицы карданного вала", places:"1", amount:"200 г", buy:GAZ_33104_BUY.gear, grease:"По руководству: «Супер Т-3» / Лукойл ТМ-5 85W-90"},
  {point:"Подшипник промежуточной опоры кардана", places:"1", amount:"50 г", buy:GAZ_33104_BUY.litol, grease:"По руководству: Литол-24; дубль ЛИТА"},
  {point:"Подшипники шкворней", places:"4", amount:"30 г", buy:GAZ_33104_BUY.solidol, grease:"По руководству: солидол Ж или солидол С"},
  {point:"Картер заднего моста (+ ступицы задних)", places:"1", amount:"8 л", buy:GAZ_33104_BUY.gear, grease:"По руководству: «Супер Т-3» / Лукойл ТМ-5 85W-90; зимой 75W-90"},
  {point:"Подшипники ступиц передних колёс", places:"4", amount:"400±30 г", buy:GAZ_33104_BUY.litol, grease:"По руководству: Литол-24; дубль ЛИТА"},
  {point:"Манжеты ступиц задних колёс", places:"2", amount:"40 г", buy:GAZ_33104_BUY.litol, grease:"По руководству: Литол-24"},
  {point:"Амортизаторы", places:"4", amount:"550±5 см³", buy:GAZ_33104_BUY.shock, grease:"По руководству: АЖ-12Т; дубль — веретенное АУ"},
  {point:"Система ГУР", places:"1", amount:"1,5 л", buy:GAZ_33104_BUY.gur, grease:"По руководству: гидромасло Р; ниже −35 °C — ВМГЗ"},
  {point:"Уплотнитель рулевого вала", places:"1", amount:"5 г", buy:GAZ_33104_BUY.litol, grease:"По руководству: Литол-24; дубль ЛИТА"},
  {point:"Карданные шарниры рулевого привода", places:"3", amount:"6 г", buy:GAZ_33104_BUY.litol, grease:"По руководству: Литол-24; дубль солидол С/Ж"},
  {point:"Гидропривод сцепления", places:"1", amount:"0,2 л", buy:GAZ_33104_BUY.brake, grease:"По руководству: «РОСДОТ»; дубль «Томь» III-А"}
];
const GAZ_33104_BUY_LIST=[
  {need:"КПП, мост, шлицы, шарниры кардана", buy:GAZ_33104_BUY.gear},
  {need:"Опора кардана, ступицы, рулевые шарниры", buy:GAZ_33104_BUY.litol},
  {need:"Шкворни", buy:GAZ_33104_BUY.solidol},
  {need:"ГУР", buy:GAZ_33104_BUY.gur},
  {need:"Сцепление (гидропривод)", buy:GAZ_33104_BUY.brake},
  {need:"Амортизаторы (при заправке)", buy:GAZ_33104_BUY.shock},
  {need:"Охлаждающая жидкость", buy:GAZ_33104_BUY.cool},
  {need:"Моторное масло + фильтр", buy:GAZ_33104_BUY.motor}
];
const GAZ_33104_TO1_WORKS=[
  {text:"Двигатель: проверить герметичность систем охлаждения, питания и смазки",
   how:"Осмотреть двигатель снизу и сверху на холодном и прогретом моторе.\nПодтекание охлаждающей жидкости, топлива и масла не допускается.\nПри подтёках — подтянуть хомуты/пробки или заменить уплотнения."},
  {text:"Проверить состояние шлангов топливопроводов",
   how:"Осмотреть все шланги топлива на трещины, вздутия, потёртости.\nТрещины на наружной поверхности не допускаются — шланг заменить."},
  {text:"Проверить крепление фланца приёмной трубы глушителя",
   how:"Проверить гайки/болты фланца приёмной трубы.\nОслабленное крепление подтянуть; при прогаре прокладки — заменить."},
  {text:"Проверить и отрегулировать натяжение ремней привода вспомогательных агрегатов",
   how:"Нажать на ветвь ремня посередине между шкивами.\nПрогиб должен соответствовать руководству (обычно ~10–15 мм при усилии ~40 Н).\nОслабить кронштейн/натяжитель, подтянуть ремень, зафиксировать, проверить снова."},
  {text:"Заменить масло в системе смазки двигателя и масляный фильтр",
   how:"Что купить: "+GAZ_33104_BUY.motor+".\nПрогреть двигатель, заглушить, подставить ёмкость.\nОткрутить сливную пробку картера, слить масло; завернуть пробку.\nСнять масляный фильтр, смазать резиновое кольцо нового, закрутить от руки + ¾ оборота.\nЗалить масло до метки «П» (между «П» и «0», ближе к «П»).\nЗапустить 1–2 мин, заглушить, проверить уровень и отсутствие течи."},
  {text:"При первых трёх ТО-1: проверить крепление головки блока и зазоры клапанов",
   how:"Только на первых трёх ТО-1 (на холодном двигателе).\nПроверить момент затяжки болтов/гаек ГБЦ по схеме руководства.\nПроверить зазоры клапанов щупом; при необходимости отрегулировать.\nНа последующих ТО-1 пункт можно пропустить (отметить как выполненный с пометкой)."},
  {text:"Ходовая: проверить крепление колёс и стремянок рессор",
   how:"Проверить затяжку гаек колёс крест-накрест.\nПроверить гайки стремянок рессор и крепление кронштейнов.\nОслабленное крепление подтянуть."},
  {text:"Тормоза: проверить герметичность и работу рабочей тормозной системы",
   how:"При работающем двигателе нажать педаль до упора — педаль не должна уходить в пол.\nПосле нажатия до упора падение давления в системе при заглушенном двигателе — не более 0,005 МПа за 15 мин.\nЗуммер низкого давления не должен гореть постоянно (кроме подкачки после пуска).\nСделать пробное торможение на малой скорости."},
  {text:"Тормоза: проверить состояние привода и работу стояночной тормозной системы",
   how:"Рукоятка (кран) стояночного тормоза должна свободно ходить и фиксироваться в «парковке».\nНа уклоне или на передаче убедиться, что стояночный тормоз удерживает автомобиль.\nПри необходимости подтянуть трос/привод."},
  {text:"Трансмиссия: смазать шлицы карданного вала (GL-5 85W-90, ~200 г)",
   how:"Что купить: "+GAZ_33104_BUY.gear+".\nНайти пресс-маслёнку на шлицевом соединении кардана.\nШприцем нагнетать до появления свежей смазки (~200 г). Вытереть излишки.\n(В руководстве: «Супер Т-3» / Лукойл ТМ-5.)"},
  {text:"Трансмиссия: смазать подшипник промежуточной опоры кардана (Литол-24, ~50 г)",
   how:"Что купить: "+GAZ_33104_BUY.litol+".\nНайти пресс-маслёнку на промежуточной опоре кардана.\nШприцем нагнетать до появления свежей смазки (~50 г).\nВытереть излишки, проверить, что опора не имеет люфта/шумов."}
];
const GAZ_33104_TO2_WORKS=[
  {text:"Все работы ТО-1",
   how:"Сначала полностью выполнить чек-лист ТО-1 (или открыть отдельную запись ТО-1).\nНиже — дополнительные работы только для ТО-2."},
  {text:"Двигатель: проверить подушки подвески двигателя",
   how:"Осмотреть передние и задние подушки двигателя.\nРасслоение, разрывы и попадание масла на подушки не допускаются — заменить."},
  {text:"Проверить дымность отработавших газов",
   how:"На прогретом двигателе в режиме свободного ускорения оценить дымность.\nСильный чёрный/сизый дым — диагностика ТНВД, фильтров, турбины (раздел 3 руководства)."},
  {text:"Проверить работу привода подачи топлива",
   how:"Проверить ход педали газа и тяг/троса привода ТНВД без заеданий.\nРычаг ТНВД должен доходить до упоров холостого хода и полной подачи."},
  {text:"Проверить крепления двигателя, вентилятора, шкива коленвала, радиатора",
   how:"Подтянуть ослабленные гайки/болты крепления двигателя к раме.\nПроверить крепление вентилятора, шкива коленвала и радиатора.\nОслабленное крепление подтянуть."},
  {text:"Проверить крепления шлангов воздушного фильтра / турбокомпрессора / охладителя наддува",
   how:"Проверить хомуты: воздушный фильтр → турбина → охладитель → впуск.\nПодтянуть ослабленные хомуты; порванные патрубки заменить.\nПодсос воздуха не допускается."},
  {text:"Проверить крепления газопроводов и турбокомпрессора",
   how:"Проверить болты/гайки крепления турбокомпрессора и газопроводов.\nОслабленное крепление подтянуть; при утечке газов — прокладки."},
  {text:"Проверить и отрегулировать зазоры клапанов (при необходимости)",
   how:"На холодном двигателе снять крышку клапанов.\nПроверить зазоры щупом по порядку цилиндров руководства.\nПри отклонении — отрегулировать и законтрить.\nПоставить крышку, проверить отсутствие течи масла."},
  {text:"Вымыть и протереть двигатель (при необходимости)",
   how:"Закрыть генератор и электроразъёмы.\nВымыть моторный отсек моющим средством, смыть, протереть.\nПосле мойки проверить уровни и отсутствие течей."},
  {text:"Очистить корпус воздушного фильтра; продуть или заменить фильтрующий элемент",
   how:"Снять крышку корпуса фильтра, вынуть элемент.\nПродуть элемент изнутри гофр, затем снаружи сжатым воздухом (не выше допуска).\nПри повреждении/замасливании — заменить.\nОчистить корпус, собрать, проверить плотность посадки."},
  {text:"Очистить корпус фильтра тонкой очистки топлива и заменить элемент",
   how:"Сбросить давление/перекрыть подачу при необходимости.\nСнять корпус фильтра тонкой очистки, заменить бумажный элемент.\nСобрать, прокачать топливо, убедиться в отсутствии подтёков."},
  {text:"Трансмиссия: проверить люфт карданной передачи; крепления КПП, фланцев, заднего моста",
   how:"Покачать кардан у шарниров и шлицев — люфт сверх нормы не допускается.\nПодтянуть крепления картера сцепления/КПП, фланцев карданов, промежуточной опоры.\nОбойма сальников шлицев — до совмещения переднего торца с канавкой втулки.\nПодтянуть фланец и муфту ведущей шестерни заднего моста."},
  {text:"Очистить сапуны КПП и заднего моста",
   how:"Снять/прочистить сапуны КПП и заднего моста от грязи.\nПроверить, что канал сапуна не забит — иначе выдавливает масло через уплотнения."},
  {text:"Заменить масло в КПП и заднем мосту (GL-5 85W-90; зимой 75W-90)",
   how:"Что купить: "+GAZ_33104_BUY.gear+" (~8 л на мост + КПП по уровню).\nСразу после поездки (масло тёплое) подставить ёмкость.\nОткрутить сливные пробки КПП и моста, слить масло, завернуть пробки.\nЗалить до нижней кромки наливного отверстия. Завернуть пробки, проверить течи.\n(В руководстве: «Супер Т-3» / Лукойл ТМ-5.)"},
  {text:"Смазать подшипники карданных шарниров и шлицы (GL-5); опору — Литол-24",
   how:"Что купить: трансмиссия — "+GAZ_33104_BUY.gear+"; опора — "+GAZ_33104_BUY.litol+".\nЧерез пресс-маслёнки нагнетать до появления свежей смазки:\n• шарниры и шлицы кардана — GL-5 (~200 г на шлицы);\n• промежуточная опора — Литол-24 (~50 г).\nВытереть излишки."},
  {text:"Ходовая: проверить амортизаторы, полуоси, буксирное устройство",
   how:"Проверить крепление амортизаторов и кронштейнов, подтянуть.\nПроверить крепление полуосей и буксирного устройства к раме.\nТечи амортизаторов / сорванные крепления — заменить или ремонтировать."},
  {text:"Проверить/отрегулировать схождение передних колёс; состояние шин и дисков",
   how:"На ровной площадке проверить схождение (норма 2–4 мм по руководству).\nОсмотреть шины: гвозди, порезы, неравномерный износ; давление — по норме на холодных.\nНа ободьях не должно быть вмятин."},
  {text:"Обслуживание ступиц колёс: очистка, подшипники, Литол-24, регулировка",
   how:"Что купить: "+GAZ_33104_BUY.litol+".\nСнять колпак/ступицу, очистить от старой смазки.\nПроверить подшипники, шейки цапф и сальники — износ/выкрашивание не допускаются.\nЗаложить смазку (передние ступицы ~400±30 г на точку; манжеты задних — ~40 г).\nСобрать и отрегулировать подшипники по руководству (раздел 5)."},
  {text:"При необходимости отбалансировать и переставить колёса",
   how:"При вибрации на скорости — балансировка колёс.\nПо схеме перестановки поменять местами колёса для равномерного износа."},
  {text:"Рулевое: герметичность ГУР (ATF Dexron), люфты, крепления механизма и колонки",
   how:"Что купить / долить: "+GAZ_33104_BUY.gur+".\nУровень в бачке ГУР — между MIN и MAX. Подтекание не допускается.\n(В руководстве: гидромасло Р; ниже −35 °C — ВМГЗ.)\nЛюфт руля по ободу — не более нормы; люфт шарниров колонки — заменить изношенное.\nПодтянуть крепления картера рулевого механизма, сошки, клиньев, колонки и руля."},
  {text:"Тормоза: крепление крана, трубопроводов, баллонов; колодки и диски",
   how:"Подтянуть крепление тормозного крана, трубопроводов и воздушных баллонов.\nОсмотреть колодки и диски/барабаны на износ и трещины.\nПри необходимости заменить фрикционные накладки."},
  {text:"Проверить/отрегулировать регулятор давления воздуха; при конденсате — картридж осушителя",
   how:"Проверить срабатывание регулятора давления по манометру (в диапазоне руководства).\nСлить конденсат из баллонов; при обильном конденсате/масле — заменить картридж осушителя."},
  {text:"Электрооборудование: фары, АКБ (очистка, крепление, уровень электролита), генератор и стартер",
   how:"Проверить работу фар, сигналов, стеклоочистителя и приборов.\nАКБ: очистить клеммы, смазать ПВК/солидолом, подтянуть крепление; уровень электролита — между метками.\nПроверить крепление и работу генератора и стартера, натяжение ремня генератора."},
  {text:"Проверить крепление кабины, оперения, зеркал; состояние ЛКП кабины",
   how:"Подтянуть крепления кабины, крыльев, капота, зеркал.\nОсмотреть ЛКП: сколы до металла — зачистить и подкрасить, чтобы не ржавело."}
];
const GAZ_33104_SO_WORKS=[
  {text:"Выполняется раз в год вместе с очередным ТО-1 или ТО-2",
   how:"Делать осенью (перед зимой) совместно с ближайшим ТО-1 или ТО-2.\nПункты ниже — дополнительно к выбранному ТО."},
  {text:"Проверить плотность охлаждающей жидкости (осенью)",
   how:"Что купить при замене: "+GAZ_33104_BUY.cool+".\nНа холодном двигателе взять пробу из расширительного бачка.\nПлотность при 20 °C должна быть 1,075–1,085 г/см³.\nПри меньшей плотности — заменить или довести концентрат."},
  {text:"Очистить/промыть фильтр грубой очистки топлива (осенью)",
   how:"Снять корпус фильтра-отстойника грубой очистки.\nПромыть фильтрующий элемент, очистить корпус.\nСобрать, убедиться в отсутствии подтёков топлива."},
  {text:"Слить отстой из топливного бака и фильтров (осенью)",
   how:"Слить отстой из топливного бака, корпуса фильтра-отстойника и фильтра тонкой очистки.\nПосле слива проверить герметичность пробок и корпусов — подтёков быть не должно."},
  {text:"Проверить плотность электролита АКБ (осенью)",
   how:"Ареометром проверить плотность электролита по банкам.\nПри низкой плотности — зарядка; при необходимости довести уровень дистиллированной водой.\nКлеммы очистить и смазать."},
  {text:"Смазать карданные шарниры рулевого управления и уплотнитель рулевого вала (Литол-24)",
   how:"Что купить: "+GAZ_33104_BUY.litol+".\nЧерез пресс-маслёнки шарниров рулевого привода нагнетать до появления свежей смазки (~6 г на 3 точки).\nСдвинуть кромку уплотнителя рулевого вала и смазать рабочую поверхность вала (~5 г)."}
];
const GAZ_33104_SERVICE_INTERVALS=[
  {name:"ТО-1 (ГАЗ 33104)", everyKm:10000, everyMonths:12, note:"По руководству ГАЗ-33104: каждые 10 000 км или раз в год. У каждого пункта — как делать.", works:GAZ_33104_TO1_WORKS},
  {name:"ТО-2 (ГАЗ 33104)", everyKm:20000, everyMonths:12, note:"По руководству ГАЗ-33104: каждые 20 000 км (включает ТО-1 + расширенный объём).", works:GAZ_33104_TO2_WORKS},
  {name:"СО — сезонное ТО", everyKm:null, everyMonths:12, note:"Сезонное обслуживание раз в год, совместно с ТО-1 или ТО-2.", works:GAZ_33104_SO_WORKS}
];
function isGaz33104Valdai(v){
  if(!v) return false;
  return normPlateKey(v.plate)===normPlateKey('В 603 СА 47')
    || /33104|валдай/i.test(v.makeModel||'');
}
function gaz33104LubeTableHtml(){
  return `<details style="margin-top:10px" open>
    <summary style="cursor:pointer;color:var(--accent);font-weight:700;font-size:.82rem">Таблица смазки — что купить сегодня</summary>
    <div class="svc-buy-list">
      <strong>Список в магазин (современные аналоги)</strong>
      <ul>${GAZ_33104_BUY_LIST.map(x=>`<li><b>${esc(x.need)}:</b> ${esc(x.buy)}</li>`).join('')}</ul>
    </div>
    <div style="overflow-x:auto;margin-top:8px">
      <table class="svc-lube">
        <thead><tr><th>Узел</th><th>Точ. / объём</th><th>Что купить / лить</th></tr></thead>
        <tbody>
          ${GAZ_33104_LUBE_TABLE.map(r=>`<tr>
            <td>${esc(r.point)}</td>
            <td>${esc(r.places)} · ${esc(r.amount)}</td>
            <td><div class="buy">${esc(r.buy||r.grease)}</div>${r.grease?`<div class="old">${esc(r.grease)}</div>`:''}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="meta" style="margin-top:4px">Через пресс-маслёнки — до появления свежей смазки. Серым — название из руководства ГАЗ-33104 (табл. 2.4).</div>
  </details>`;
}
const DEFAULT_DRIVERS=[
  {name:"Наволоцкий Е.Н.",salaryPercent:30,exchangeEnabled:false,phone:""}
];
const FLUIDS=["Максимум","Середина","Минимум"];
/** Активный водитель сессии (выбирается на экране «Водитель»). */
let DRIVER="";
let DRIVER_COMPANY_ID=null;
const DRIVER_SESSION_KEY="armada_driver_session_v1";
/** Слабые PIN из истории репо — при входе требуем смену (P0.1 compliance). */
const WEAK_ADMIN_PINS=new Set(["2580","45680","1234","0000"]);
function generateAdminPin(){
  let s="";
  for(let i=0;i<6;i++) s+=String(Math.floor(Math.random()*10));
  return s;
}
function normalizeLoginInn(raw){
  return String(raw||'').replace(/\D/g,'');
}
function dayKeyFromIso(iso){
  if(!iso) return '';
  const d=new Date(iso);
  if(Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
const APP_BUILD=(typeof globalThis!=='undefined'&&globalThis.ARMADA_APP_BUILD)||'2026-10-19-fix409';
const CUST_PORTAL_SYNC_KEY='armada_customer_portal_sync_v1';
/** Корпоративная почта @armada.sx (biz.mail.ru; алиасы → info@armada.sx). */
const ARMADA_MAIL={
  info:'info@armada.sx',
  hello:'hello@armada.sx',
  support:'support@armada.sx',
  pilot:'pilot@armada.sx',
  noreply:'noreply@armada.sx'
};
function armadaMail(kind){ return ARMADA_MAIL[kind]||ARMADA_MAIL.info; }
function armadaMailto(kind, subject){
  const addr=armadaMail(kind);
  if(!subject) return 'mailto:'+addr;
  return 'mailto:'+addr+'?subject='+encodeURIComponent(String(subject));
}
const ENTRY_MODES=['driver','admin','customer','owner'];
const ENTRY_SESSION_KEY='armada_entry_mode_v1';
function normalizeEntryMode(v){
  const x=String(v||'').trim().toLowerCase();
  return ENTRY_MODES.includes(x)?x:null;
}
function readEntryFromUrl(){
  try{
    const q=(typeof URLSearchParams!=='undefined')
      ?new URLSearchParams(location.search||'')
      :{get:()=>null};
    const fromQ=normalizeEntryMode(q.get('entry'));
    if(fromQ) return fromQ;
    const path=(location.pathname||'').toLowerCase();
    if(/driver\.html$/i.test(path)||/^\/v(?:\/|$)/.test(path)) return 'driver';
    if(/^\/o(?:\/|$)/.test(path)) return 'owner';
    if(/admin\.html$/i.test(path)||/^\/a(?:\/|$)/.test(path)) return 'admin';
    if(/zakaz\.html$/i.test(path)||/^\/z(?:\/|$)/.test(path)) return 'customer';
  }catch(_){}
  return null;
}
function setEntryMode(mode){
  const m=normalizeEntryMode(mode);
  try{
    if(m) sessionStorage.setItem(ENTRY_SESSION_KEY,m);
    else sessionStorage.removeItem(ENTRY_SESSION_KEY);
  }catch(_){}
}
function getEntryMode(){
  try{
    const fromUrl=readEntryFromUrl();
    if(fromUrl){
      setEntryMode(fromUrl);
      return fromUrl;
    }
    return normalizeEntryMode(sessionStorage.getItem(ENTRY_SESSION_KEY));
  }catch(_){ return null; }
}
function initEntryFromPage(){
  const fromUrl=readEntryFromUrl();
  if(fromUrl) setEntryMode(fromUrl);
}
function entryFromQueryOnly(){
  try{
    const q=new URLSearchParams(location.search||'');
    return normalizeEntryMode(q.get('entry'));
  }catch(_){ return null; }
}
function entryLoginScreenId(){
  const fromPath=readEntryFromUrl();
  if(fromPath){
    if(fromPath==='driver') return 'driver-login';
    if(fromPath==='owner') return 'owner-login';
    if(fromPath==='admin') return 'admin-pin';
    if(fromPath==='customer') return 'customer-login';
  }
  const m=entryFromQueryOnly();
  if(m==='driver') return 'driver-login';
  if(m==='owner') return 'owner-login';
  if(m==='admin') return 'admin-pin';
  if(m==='customer') return 'customer-login';
  return 'roles';
}
function armadaGoPublicLanding(){
  if(typeof globalThis.armadaGoPublicLanding==='function') globalThis.armadaGoPublicLanding();
  else try{ location.replace('/landing.html'); }catch(_){}
}
function showRoleHub(){
  if(typeof isDedicatedEntryUrl==='function' && isDedicatedEntryUrl()){
    if(typeof openDedicatedEntryScreen==='function' && openDedicatedEntryScreen()) return;
    const sid=typeof entryLoginScreenId==='function'?entryLoginScreenId():null;
    if(sid && sid!=='roles' && typeof show==='function'){ show(sid); return; }
    if(typeof window.__armadaApplyEntryRoute==='function') window.__armadaApplyEntryRoute();
    return;
  }
  if(typeof clearEntrySkin==='function') clearEntrySkin();
  armadaGoPublicLanding();
}
function openDedicatedEntryScreen(){
  initEntryFromPage();
  if(typeof initPortalScopeFromPage==='function') initPortalScopeFromPage();
  const mode=typeof dedicatedEntryMode==='function'?dedicatedEntryMode():readEntryFromUrl();
  if(mode==='admin' && typeof openAdminLogin==='function'){ openAdminLogin(); return true; }
  if(mode==='owner' && typeof openOwnerLogin==='function'){ openOwnerLogin(); return true; }
  if(mode==='driver' && typeof openDriverLogin==='function'){ openDriverLogin(false); return true; }
  if(mode==='customer'){
    if(typeof showCustomerPortal==='function') showCustomerPortal();
    else if(typeof openCustomerLogin==='function') openCustomerLogin();
    return true;
  }
  return false;
}
function isArmadaEntryScreenVisible(){
  return !!document.querySelector('#admin.show,#admin-pin.show,#driver.show,#driver-login.show,#owner-login.show,#customer-login.show,#customer-portal.show');
}
function bootFallbackAfterSplash(){
  if(isArmadaEntryScreenVisible()) return;
  if(typeof isRoleHubUrl==='function' && isRoleHubUrl()){
    if(typeof finishSplashOnce==='function') finishSplashOnce(showRoleHub);
    else showRoleHub();
    return;
  }
  if(typeof dedicatedEntryMode==='function' && dedicatedEntryMode()){
    if(typeof openDedicatedEntryScreen==='function' && openDedicatedEntryScreen()) return;
  }
  if(typeof showDefaultAfterSplash==='function') showDefaultAfterSplash();
  else armadaGoPublicLanding();
}
function showHubAfterSplash(){
  if(document.querySelector('#splash.show') && typeof finishSplashOnce==='function') finishSplashOnce(showRoleHub);
  else showRoleHub();
}
function entryPathWithSlash(path){
  const p=String(path||'/');
  if(p==='/'||p.endsWith('/')) return p;
  return p+'/';
}
function entryLandingPage(mode){
  const m=normalizeEntryMode(mode)||getEntryMode();
  const origin=(typeof location!=='undefined'&&location.origin)?location.origin:'';
  if(m==='driver') return `${origin}${entryPathWithSlash('/v')}`;
  if(m==='owner') return `${origin}${entryPathWithSlash('/o')}`;
  if(m==='admin') return `${origin}${entryPathWithSlash('/a')}`;
  if(m==='customer'){
    const sc=getPortalScope();
    if(sc&&sc.portalSlug) return `${origin}/z/${encodeURIComponent(sc.portalSlug)}/`;
    if(sc&&sc.spaceId){
      const sp=findSpaceById(sc.spaceId);
      if(sp&&sp.portalSlug) return `${origin}/z/${encodeURIComponent(sp.portalSlug)}/`;
    }
    return `${origin}${entryPathWithSlash('/z')}`;
  }
  return `${origin}${entryPathWithSlash('/a')}`;
}
function customerPortalPageUrl(opts){
  try{
    const o=opts&&typeof opts==='object'?opts:{};
    const origin=location.origin;
    if(o.companyId) return `${origin}/z?c=${encodeURIComponent(o.companyId)}`;
    let spaceId=o.spaceId;
    if(!spaceId && typeof currentSpaceId==='function') spaceId=currentSpaceId();
    if(spaceId){
      const sp=findSpaceById(spaceId);
      if(sp&&sp.portalSlug) return `${origin}/z/${encodeURIComponent(sp.portalSlug)}/`;
    }
    return `${origin}/z`;
  }catch(_){
    return `${location.origin}/z`;
  }
}
const PORTAL_SCOPE_KEY='armada_portal_scope_v1';
function readPortalScopeFromUrl(){
  try{
    const path=(location.pathname||'').toLowerCase();
    const slugM=path.match(/\/z\/([a-z0-9][a-z0-9_-]{2,31})\/?$/i);
    if(slugM) return {portalSlug:slugM[1].toLowerCase()};
    const q=new URLSearchParams(location.search||'');
    const companyId=String(q.get('c')||q.get('company')||'').trim();
    const spaceId=String(q.get('s')||q.get('space')||'').trim();
    if(companyId) return {companyId};
    if(spaceId) return {spaceId};
  }catch(_){}
  return null;
}
function resolvePortalScope(scope){
  const sc=scope||getPortalScope();
  if(!sc) return null;
  if(sc.companyId||sc.spaceId) return sc;
  if(sc.portalSlug){
    const sp=findSpaceByPortalSlug(sc.portalSlug);
    if(sp) return {spaceId:sp.id, portalSlug:sp.portalSlug};
  }
  return sc;
}
function initPortalScopeFromPage(){
  const scope=readPortalScopeFromUrl();
  if(scope){
    try{ sessionStorage.setItem(PORTAL_SCOPE_KEY, JSON.stringify(scope)); }catch(_){}
  }
}
function getPortalScope(){
  try{
    const fromUrl=readPortalScopeFromUrl();
    if(fromUrl) return fromUrl;
    const raw=sessionStorage.getItem(PORTAL_SCOPE_KEY);
    return raw?JSON.parse(raw):null;
  }catch(_){ return null; }
}
function portalScopeCarrierLabel(scope){
  const sc=resolvePortalScope(scope);
  if(!sc) return '';
  if(sc.companyId){
    const co=typeof findCompanyById==='function'?findCompanyById(sc.companyId):null;
    if(co){
      const sp=co.spaceId?findSpaceById(co.spaceId):null;
      return sp?sp.name:(co.name||'');
    }
  }
  if(sc.spaceId){
    const sp=findSpaceById(sc.spaceId);
    return sp?sp.name:'';
  }
  if(sc.portalSlug){
    const sp=findSpaceByPortalSlug(sc.portalSlug);
    return sp?sp.name:'';
  }
  return '';
}
function isDedicatedEntryUrl(){
  try{
    const path=(location.pathname||'').toLowerCase();
    return /^\/(v|a|z|o)(?:\/|$)/.test(path)
      || /(driver|admin|zakaz)\.html$/i.test(path);
  }catch(_){ return false; }
}
/** Корень app (/ или /index.html): гость → landing; сессия → tryRestoreRoleHubSession в boot. */
function isRoleHubUrl(){
  try{
    if(isDedicatedEntryUrl()) return false;
    const path=(location.pathname||'').toLowerCase();
    return path==='/' || path==='/index.html';
  }catch(_){ return false; }
}
function dedicatedEntryMode(){
  if(!isDedicatedEntryUrl()) return null;
  return readEntryFromUrl();
}
function adminEntryRequiresPin(){
  return dedicatedEntryMode()==='admin';
}
function markAdminPinOk(){
  try{ sessionStorage.setItem(ADMIN_PIN_OK_KEY,'1'); }catch(_){}
}
function isAdminPinOk(){
  try{ return sessionStorage.getItem(ADMIN_PIN_OK_KEY)==='1'; }catch(_){ return false; }
}
function clearAdminPinOk(){
  try{ sessionStorage.removeItem(ADMIN_PIN_OK_KEY); }catch(_){}
}
function canAutoRestoreAdmin(){
  if(typeof armadaApiTokenRole==='function' && armadaApiTokenRole()==='owner_driver') return false;
  if(typeof restoreAdminSession!=='function') return false;
  if(!restoreAdminSession()) return false;
  if(adminEntryRequiresPin()) markAdminPinOk();
  return true;
}
function reconcileAdminSessionAfterSync(){
  if(typeof currentAdmin==='undefined' || !currentAdmin) return;
  if(typeof migrateAdmins==='function') migrateAdmins();
  if(typeof migrateSpaces==='function') migrateSpaces();
  let adm=(state.admins||[]).find(a=>a.id===currentAdmin.id)
    || (state.admins||[]).find(a=>samePersonName(a.name, currentAdmin.name));
  if(!adm && isAdminPinOk() && typeof restoreAdminSession==='function' && restoreAdminSession()) return;
  if(!adm){
    currentAdmin=null;
    if(typeof clearAdminSession==='function') clearAdminSession();
    if(adminEntryRequiresPin()) clearAdminPinOk();
    if(document.querySelector('#admin.show') && typeof openAdminLogin==='function') openAdminLogin();
    return;
  }
  currentAdmin={id:adm.id, name:adm.name, isSuper:!!adm.isSuper, spaceId:adm.spaceId||null};
  if(typeof saveAdminSession==='function') saveAdminSession();
  if(document.querySelector('#admin.show')){
    if(typeof renderAdmin==='function') renderAdmin();
    if(typeof updateAdminChrome==='function') updateAdminChrome();
  }
}
const DRIVER_FROM_ADMIN_KEY='armada_driver_from_admin_v1';
function setDriverFromAdmin(on){
  try{
    if(on) sessionStorage.setItem(DRIVER_FROM_ADMIN_KEY,'1');
    else sessionStorage.removeItem(DRIVER_FROM_ADMIN_KEY);
  }catch(_){}
}
function isDriverFromAdmin(){
  try{ return sessionStorage.getItem(DRIVER_FROM_ADMIN_KEY)==='1'; }catch(_){ return false; }
}
function goEntryLanding(mode){
  const page=entryLandingPage(mode);
  try{
    const u=new URL(page, location.href);
    location.href=u.href;
  }catch(_){
    location.href=page;
  }
}
function customerKpPageUrl(){
  const origin=(typeof location!=='undefined'&&location.origin)?location.origin:'';
  const q=new URLSearchParams();
  try{
    const sc=typeof getPortalScope==='function'?getPortalScope():null;
    if(sc&&sc.portalSlug) q.set('z', sc.portalSlug);
    const label=typeof portalScopeCarrierLabel==='function'?portalScopeCarrierLabel():'';
    if(label) q.set('carrier', label);
  }catch(_){}
  const qs=q.toString();
  return `${origin}/kp-zakaz.html${qs?'?'+qs:''}`;
}
/** Типы транспорта для кнопок «Заказать» на armada.sx → app.armada.sx/order.html */
const ARMADA_SX_ORDER_VTYPES=[
  {id:'shalanda', label:'Шаланда'},
  {id:'manipulator', label:'Манипулятор'},
  {id:'tent', label:'Тентованный'},
  {id:'dump', label:'Самосвал'},
  {id:'tral', label:'Трал'},
  {id:'board', label:'Бортовой'}
];
/** Типовые т/габариты кузова для заявок с order.html (подбор ТС; логист может поправить). */
const ARMADA_SX_VTYPE_DEFAULT_REQS={
  shalanda:{reqPayloadTons:20,reqLengthM:13.6,reqWidthM:2.45,reqHeightM:2.5},
  manipulator:{reqPayloadTons:5,reqLengthM:6,reqWidthM:2.4,reqHeightM:2.2},
  tent:{reqPayloadTons:20,reqLengthM:13.6,reqWidthM:2.45,reqHeightM:2.7},
  dump:{reqPayloadTons:15,reqLengthM:6.5,reqWidthM:2.3,reqHeightM:1.5},
  tral:{reqPayloadTons:40,reqLengthM:13.6,reqWidthM:2.5,reqHeightM:0.6},
  board:{reqPayloadTons:10,reqLengthM:6,reqWidthM:2.4,reqHeightM:2.2}
};
/** Высота пола кузова/платформы от дороги, м (ориентир для проверки 4 м с грузом). */
const ARMADA_SX_VTYPE_DECK_HEIGHT_M={
  shalanda:1.15, manipulator:0.55, tent:1.15, dump:1.2, tral:0.85, board:0.9
};
const ARMADA_ROAD_MAX_HEIGHT_M=4;
const ARMADA_ROAD_HEIGHT_LIMIT_M=3.95;
function armadaVtypeDeckHeightM(vtypeId){
  const id=String(vtypeId||'').trim();
  if(id&&ARMADA_SX_VTYPE_DECK_HEIGHT_M[id]>0) return ARMADA_SX_VTYPE_DECK_HEIGHT_M[id];
  return 1;
}
function armadaCargoRoadHeightViolation(vtypeId, cargoHeightM){
  const cargo=+cargoHeightM;
  if(!(cargo>0)) return null;
  const deck=armadaVtypeDeckHeightM(vtypeId);
  const sum=Math.round((deck+cargo)*100)/100;
  if(sum<=ARMADA_ROAD_HEIGHT_LIMIT_M) return null;
  return {deck, cargo, sum, limit:ARMADA_ROAD_MAX_HEIGHT_M};
}
function armadaHeightRoadWarningText(v){
  if(!v) return '';
  const d=String(v.deck).replace('.',',');
  const c=String(v.cargo).replace('.',',');
  const s=String(v.sum).replace('.',',');
  return `Пол кузова ${d} м + высота груза ${c} м = ${s} м. По приложению № 1 к Правилам перевозок грузов (постановление Правительства РФ № 2200 от 21.12.2020) допустимая высота транспортного средства с грузом — не более 4 м от поверхности дороги.\n\nВам требуется негабаритная перевозка (разрешение и маршрут). Выберите другой тип ТС, если изменение высоты груза не допустимо.`;
}
function applyVehicleTypeDefaultReqs(o, onlyEmpty){
  if(!o||typeof o!=='object') return o;
  const vtid=(Array.isArray(o.vehicleTypeIds)&&o.vehicleTypeIds[0])||'';
  const def=ARMADA_SX_VTYPE_DEFAULT_REQS[vtid]||null;
  if(!def) return o;
  const fill=(k,v)=>{
    if(!(v>0)) return;
    if(onlyEmpty && (o[k]>0)) return;
    o[k]=v;
  };
  fill('reqPayloadTons', def.reqPayloadTons);
  fill('reqLengthM', def.reqLengthM);
  fill('reqWidthM', def.reqWidthM);
  fill('reqHeightM', def.reqHeightM);
  if(!o.reqBodyType&&typeof mapVtypeToBodyType==='function') o.reqBodyType=mapVtypeToBodyType(vtid);
  if(!(o.cargoVolumeM3>0)&&o.reqLengthM>0&&o.reqWidthM>0&&o.reqHeightM>0){
    o.cargoVolumeM3=Math.round(o.reqLengthM*o.reqWidthM*o.reqHeightM*10)/10;
  }
  return o;
}
function migrateArmadaSxOrderReqs(){
  let changed=false;
  (state.orders||[]).forEach(o=>{
    if(!o||o.source!=='armada_sx') return;
    const before=JSON.stringify([o.reqPayloadTons,o.reqLengthM,o.reqWidthM,o.reqHeightM,o.cargoVolumeM3]);
    applyVehicleTypeDefaultReqs(o, true);
    const after=JSON.stringify([o.reqPayloadTons,o.reqLengthM,o.reqWidthM,o.reqHeightM,o.cargoVolumeM3]);
    if(before!==after) changed=true;
  });
  if(changed) bumpDataEpoch('armada-sx-req-defaults');
  return changed;
}
function armadaPublicOrderUrl(opts){
  const o=opts&&typeof opts==='object'?opts:{};
  const origin=(typeof location!=='undefined'&&location.origin)?location.origin:ARMADA_LIVE_ORIGIN;
  const q=new URLSearchParams();
  const vtype=String(o.vtype||o.type||'').trim().toLowerCase();
  if(vtype) q.set('vtype', vtype);
  q.set('source', String(o.source||'armada.sx').trim()||'armada.sx');
  const qs=q.toString();
  return `${origin}/order.html${qs?'?'+qs:''}`;
}
function armadaCustomerPortalOrderUrl(opts){
  const o=opts&&typeof opts==='object'?opts:{};
  const origin=(typeof location!=='undefined'&&location.origin)?location.origin:ARMADA_LIVE_ORIGIN;
  const q=new URLSearchParams();
  const vtype=String(o.vtype||o.type||'').trim().toLowerCase();
  if(vtype) q.set('vtype', vtype);
  const source=String(o.source||'armada.sx').trim();
  if(source) q.set('source', source);
  let base=`${origin}/z/`;
  try{
    const sc=typeof getPortalScope==='function'?getPortalScope():null;
    if(sc&&sc.portalSlug) base=`${origin}/z/${encodeURIComponent(sc.portalSlug)}/`;
  }catch(_){}
  const qs=q.toString();
  return qs?`${base}?${qs}`:base;
}
function normalizeArmadaSxVtype(raw){
  const id=String(raw||'').trim().toLowerCase();
  if(!id) return '';
  if(id==='other') return 'other';
  if(typeof custVehicleTypeMeta==='function' && custVehicleTypeMeta(id)) return id;
  const hit=ARMADA_SX_ORDER_VTYPES.find(x=>x.id===id);
  return hit?hit.id:'';
}
function backFromEntryLogin(opts){
  const fromAdmin=opts&&opts.fromAdmin;
  if(fromAdmin && (typeof currentAdmin!=='undefined'&&currentAdmin || typeof restoreAdminSession==='function'&&restoreAdminSession())){
    if(typeof show==='function') show('admin');
    if(typeof renderAdmin==='function') renderAdmin();
    return;
  }
  if(typeof isDedicatedEntryUrl==='function' && isDedicatedEntryUrl()){
    const href=typeof globalThis.armadaPublicLandingHref==='function'
      ?globalThis.armadaPublicLandingHref(typeof location!=='undefined'?location.search:'')
      :'/landing.html';
    try{ location.assign(href); return; }catch(_){}
  }
  setEntryMode(null);
  armadaGoPublicLanding();
}
/** Прод-хосты: VPS и основной домен приложения. */
function isArmadaProdHost(hostname){
  const h=(hostname||'').toLowerCase();
  return h==='app.armada.sx'||h==='staging.app.armada.sx'||h==='aptown1.fvds.ru'||h==='176.12.67.35';
}
const ARMADA_LIVE_ORIGIN='https://app.armada.sx';
/** Backend API (S0). Локально → armada-api; на проде → Caddy prefix. */
const API_BASE=(()=>{
  if(typeof location==='undefined') return '';
  const h=location.hostname;
  if(h==='localhost'||h==='127.0.0.1') return 'http://127.0.0.1:8787';
  if(isArmadaProdHost(h)) return `${location.origin}/armada-api`;
  return '';
})();
const BODY_TYPES=[
  {id:'tent', label:'Тент / фургон'},
  {id:'board', label:'Бортовой'},
  {id:'reefer', label:'Рефрижератор'},
  {id:'dump', label:'Самосвал'}
];
/** Типы кузова ATI (61) — поиск в форме заказчика. mapTo — id для тарифа. */
const ATI_BODY_TYPES=[
  {id:"tent",ati:"тентованный",label:"тентованный",mapTo:"tent",keywords:["тент.","tent truck","тентованный"]},
  {id:"container",ati:"контейнер",label:"контейнер",mapTo:"tent",keywords:["конт.","container","контейнер"]},
  {id:"van",ati:"фургон",label:"фургон",mapTo:"tent",keywords:["фург.","van","фургон"]},
  {id:"metal",ati:"цельнометалл.",label:"цельнометалл.",mapTo:"tent",keywords:["цмет.","all-metal","цельнометалл."]},
  {id:"isotherm",ati:"изотермический",label:"изотермический",mapTo:"reefer",keywords:["изотерм","isothermal","изотермический"]},
  {id:"reefer",ati:"рефрижератор",label:"рефрижератор",mapTo:"reefer",keywords:["реф.","refrigerator","рефрижератор"]},
  {id:"reefer_multimode",ati:"реф. мультирежимный",label:"реф. мультирежимный",mapTo:"reefer",keywords:["реф.мульт.","refrigerator mult.","реф. мультирежимный"]},
  {id:"reefer_partition",ati:"реф. с перегородкой",label:"реф. с перегородкой",mapTo:"reefer",keywords:["реф.с перег.","bulkhead refr.","реф. с перегородкой"]},
  {id:"reefer_meat",ati:"реф.-тушевоз",label:"реф.-тушевоз",mapTo:"reefer",keywords:["р-туш.","meat rails ref.","реф.-тушевоз"]},
  {id:"board",ati:"бортовой",label:"бортовой",mapTo:"board",keywords:["борт.","flatbed","бортовой"]},
  {id:"open",ati:"открытый конт.",label:"открытый конт.",mapTo:"board",keywords:["откр.конт.","opentop","открытый конт."]},
  {id:"platform",ati:"площадка без бортов",label:"площадка без бортов",mapTo:"board",keywords:["безборт.","opentrailer","площадка без бортов"]},
  {id:"dump",ati:"самосвал",label:"самосвал",mapTo:"dump",keywords:["ссвл.","dump truck","самосвал"]},
  {id:"shalanda",ati:"шаланда",label:"шаланда",mapTo:"board",keywords:["шал.","barge","шаланда"]},
  {id:"oversize",ati:"негабарит",label:"негабарит",mapTo:"board",keywords:["негаб.","outsize","негабарит"]},
  {id:"lowbed",ati:"низкорамный",label:"низкорамный",mapTo:"board",keywords:["рамн.","dolly","низкорамный"]},
  {id:"lowbed_platform",ati:"низкорам.платф.",label:"низкорам.платф.",mapTo:"board",keywords:["нпл.","dolly plat.","низкорам.платф."]},
  {id:"telescopic",ati:"телескопический",label:"телескопический",mapTo:"board",keywords:["телскп.","adjustable","телескопический"]},
  {id:"tral",ati:"трал",label:"трал",mapTo:"board",keywords:["трал","tral"]},
  {id:"beam_truck",ati:"балковоз(негабарит)",label:"балковоз(негабарит)",mapTo:"board",keywords:["балк.","beam truck(ngb)","балковоз(негабарит)"]},
  {id:"bus",ati:"автобус",label:"автобус",mapTo:"board",keywords:["авт.","bus","автобус"]},
  {id:"car_carrier",ati:"автовоз",label:"автовоз",mapTo:"board",keywords:["автв.","autocart","автовоз"]},
  {id:"aerial_lift",ati:"автовышка",label:"автовышка",mapTo:"board",keywords:["вышк.","autotower","автовышка"]},
  {id:"car_transporter",ati:"автотранспортер",label:"автотранспортер",mapTo:"board",keywords:["автт.","auto carrier","автотранспортер"]},
  {id:"concrete_mixer",ati:"бетоновоз",label:"бетоновоз",mapTo:"board",keywords:["бет.","сoncrete truck","бетоновоз"]},
  {id:"bitumen_truck",ati:"битумовоз",label:"битумовоз",mapTo:"board",keywords:["битум","bitumen truck","битумовоз"]},
  {id:"fuel_tank",ati:"бензовоз",label:"бензовоз",mapTo:"board",keywords:["бенз.","fuel tank","бензовоз"]},
  {id:"offroader",ati:"вездеход",label:"вездеход",mapTo:"board",keywords:["вздхд.","off-roader","вездеход"]},
  {id:"gas_tank",ati:"газовоз",label:"газовоз",mapTo:"board",keywords:["газ.","gas","газовоз"]},
  {id:"grain",ati:"зерновоз",label:"зерновоз",mapTo:"dump",keywords:["зерн.","grain truck","зерновоз"]},
  {id:"horse_carrier",ati:"коневоз",label:"коневоз",mapTo:"board",keywords:["кони.","horse truck","коневоз"]},
  {id:"container_carrier",ati:"контейнеровоз",label:"контейнеровоз",mapTo:"board",keywords:["конт-воз","container trail.","контейнеровоз"]},
  {id:"feed_truck",ati:"кормовоз",label:"кормовоз",mapTo:"board",keywords:["корм.","furage tuck","кормовоз"]},
  {id:"crane_truck",ati:"кран",label:"кран",mapTo:"board",keywords:["кран","crane"]},
  {id:"timber",ati:"лесовоз",label:"лесовоз",mapTo:"board",keywords:["лесв.","timber truck","лесовоз"]},
  {id:"scrap_truck",ati:"ломовоз",label:"ломовоз",mapTo:"board",keywords:["лом.","scrap truck","ломовоз"]},
  {id:"manipulator",ati:"манипулятор",label:"манипулятор",mapTo:"board",keywords:["манип","manipulator","манипулятор"]},
  {id:"minibus",ati:"микроавтобус",label:"микроавтобус",mapTo:"board",keywords:["микр.","microbus","микроавтобус"]},
  {id:"flour_truck",ati:"муковоз",label:"муковоз",mapTo:"board",keywords:["мук.","flour truck","муковоз"]},
  {id:"panel_truck",ati:"панелевоз",label:"панелевоз",mapTo:"board",keywords:["панв.","panels truck","панелевоз"]},
  {id:"pickup",ati:"пикап",label:"пикап",mapTo:"board",keywords:["пикап","pickup"]},
  {id:"coil_truck",ati:"пухтовоз",label:"пухтовоз",mapTo:"board",keywords:["пухта","ripetruck","пухтовоз"]},
  {id:"pyramid",ati:"пирамида",label:"пирамида",mapTo:"board",keywords:["пирам.","pyramid","пирамида"]},
  {id:"roll_truck",ati:"рулоновоз",label:"рулоновоз",mapTo:"board",keywords:["рул.","roll truck","рулоновоз"]},
  {id:"tractor",ati:"седельный тягач",label:"седельный тягач",mapTo:"board",keywords:["тягач","tractor","седельный тягач"]},
  {id:"cattle_truck",ati:"скотовоз",label:"скотовоз",mapTo:"board",keywords:["скот.","cattle","скотовоз"]},
  {id:"glass_truck",ati:"стекловоз",label:"стекловоз",mapTo:"board",keywords:["сткл.","innloader","стекловоз"]},
  {id:"pipe_carrier",ati:"трубовоз",label:"трубовоз",mapTo:"board",keywords:["труб.","pipe truck","трубовоз"]},
  {id:"cement_truck",ati:"цементовоз",label:"цементовоз",mapTo:"board",keywords:["цем.","cement truck","цементовоз"]},
  {id:"tank",ati:"автоцистерна",label:"автоцистерна",mapTo:"tent",keywords:["автоцист.","tanker truck","автоцистерна"]},
  {id:"chip_truck",ati:"щеповоз",label:"щеповоз",mapTo:"board",keywords:["щеп.","chip truck","щеповоз"]},
  {id:"tow_truck",ati:"эвакуатор",label:"эвакуатор",mapTo:"board",keywords:["эвак.","wrecker","эвакуатор"]},
  {id:"cargo_passenger",ati:"грузопассажирский",label:"грузопассажирский",mapTo:"board",keywords:["грузпас.","dual-purpose","грузопассажирский"]},
  {id:"pole_truck",ati:"клюшковоз",label:"клюшковоз",mapTo:"board",keywords:["клюшк.","klyushkovoz","клюшковоз"]},
  {id:"garbage_truck",ati:"мусоровоз",label:"мусоровоз",mapTo:"board",keywords:["мусор.","garbage truck","мусоровоз"]},
  {id:"jumbo",ati:"jumbo",label:"Джамбо",mapTo:"board",keywords:["jumbo"]},
  {id:"tank_cont_20",ati:"20' танк-контейнер",label:"20' танк-контейнер",mapTo:"board",keywords:["20' танк-конт.","20' tank-container","20' танк-контейнер"]},
  {id:"tank_cont_40",ati:"40' танк-контейнер",label:"40' танк-контейнер",mapTo:"board",keywords:["40' танк-конт.","40' tank-container","40' танк-контейнер"]},
  {id:"mega_truck",ati:"мега фура",label:"мега фура",mapTo:"board",keywords:["мега","mega","мега фура"]},
  {id:"doppelstock",ati:"допельшток",label:"допельшток",mapTo:"board",keywords:["допельшток","doppelstock"]},
  {id:"extendable_semi",ati:"Раздвижной полуприцеп 20'/40'",label:"Раздвижной полуприцеп 20'/40'",mapTo:"board",keywords:["раздв. полу. 20'/40'","sliding semi-trailer 20'/40'","раздвижной полуприцеп 20'/40'"]},
];
const CUST_FORM_VTYPE_IDS=new Set(["tent","container","van","metal","isotherm","reefer","reefer_partition","reefer_multimode","board","open","dump","platform","shalanda"]);
function custExtraVehicleTypes(){return ATI_BODY_TYPES.filter(x=>!CUST_FORM_VTYPE_IDS.has(x.id));}
function custVehicleTypeMeta(id){return ATI_BODY_TYPES.find(x=>x.id===id)||null;}
function custVtypeMatchesQuery(type,q){
  const nq=String(q||'').trim().toLowerCase();
  if(!nq) return true;
  const hay=((type.ati||'')+' '+(type.label||'')+' '+(type.keywords||[]).join(' ')).toLowerCase();
  if(hay.includes(nq)) return true;
  return hay.split(/[\s,./()+'\-]+/).filter(Boolean).some(w=>w.startsWith(nq));
}
function filterCustVehicleTypesByQuery(q){
  const nq=String(q||'').trim().toLowerCase();
  if(!nq) return [];
  return ATI_BODY_TYPES.filter(t=>custVtypeMatchesQuery(t,nq));
}
function bodyTypeInputLabel(id){
  const hit=ATI_BODY_TYPES.find(x=>x.id===id)||BODY_TYPES.find(x=>x.id===id);
  return hit?(hit.label||hit.ati):'';
}
function custVehicleTypeDisplayLabel(idOrType){
  const t=typeof idOrType==='object'&&idOrType? idOrType : custVehicleTypeMeta(idOrType);
  if(t) return t.label||t.ati||t.id||'';
  return typeof bodyTypeInputLabel==='function'?bodyTypeInputLabel(idOrType):String(idOrType||'');
}
/** Типы ТС в форме заказчика (группа «все закрытые»). */
const CUST_CLOSED_VEHICLE_TYPES=[
  {id:'tent', label:'Тентованный'},
  {id:'container', label:'Контейнер'},
  {id:'van', label:'Фургон'},
  {id:'metal', label:'Цельнометаллический'}
];
const CUST_ISOTHERM_VEHICLE_TYPE={id:'isotherm', label:'Изотермический'};
const CUST_REFR_VEHICLE_TYPES=[
  {id:'reefer', label:'Рефрижератор'},
  {id:'reefer_partition', label:'Реф. с перегородкой'},
  {id:'reefer_multimode', label:'Реф. мультирежимный'}
];
const CUST_OPEN_VEHICLE_TYPES=[
  {id:'board', label:'Бортовой'},
  {id:'open', label:'Открытый конт.'},
  {id:'dump', label:'Самосвал'},
  {id:'platform', label:'Площадка'},
  {id:'shalanda', label:'Шаланда'}
];
const CUST_REAR_ONLY_VEHICLE_TYPES=new Set(['container','van','metal','reefer','reefer_partition','reefer_multimode']);
const CUST_LOAD_METHODS=[
  {id:'top', label:'верхняя'},
  {id:'side', label:'боковая'},
  {id:'rear', label:'задняя'},
  {id:'full_tent', label:'с полной растентовкой'},
  {id:'remove_crossbars', label:'со снятием поперечных перекладин'},
  {id:'remove_posts', label:'со снятием стоек'},
  {id:'no_gates', label:'без ворот'},
  {id:'tail_lift', label:'гидроборт'},
  {id:'ramps', label:'аппарели'},
  {id:'crate', label:'с обрешеткой'},
  {id:'boards', label:'с бортами'},
  {id:'side_both', label:'боковая с двух сторон'},
  {id:'pour', label:'налив'},
  {id:'pneumatic', label:'пневматический'},
  {id:'hydraulic', label:'гидравлический'},
  {id:'electric', label:'электрический'},
  {id:'diesel_compressor', label:'дизельный компрессор'}
];
const CUST_UNLOAD_METHODS=CUST_LOAD_METHODS.slice();
const CUST_TENT_LOAD_IDS=['top','side','rear','full_tent','remove_crossbars','remove_posts','no_gates','tail_lift','ramps','side_both'];
const CUST_OPEN_LOAD_IDS=['top','side','rear','full_tent','remove_crossbars','tail_lift','ramps','boards','crate','side_both'];
const CUST_DUMP_LOAD_IDS=['top','rear'];
const CUST_SPECIALIZED_LOAD_IDS={
  tank:['pour'],
  grain:['top','pour','pneumatic'],
  timber:['top','side','rear','ramps','crate','boards'],
  lowbed:['rear','ramps','tail_lift'],
  car_carrier:['rear','ramps'],
  manipulator:['rear','top','side','tail_lift']
};
function custLoadMethodsForBodyType(vtype){
  const id=String(vtype||'').trim();
  if(!id) return CUST_LOAD_METHODS.map(x=>x.id);
  if(CUST_SPECIALIZED_LOAD_IDS[id]) return CUST_SPECIALIZED_LOAD_IDS[id].slice();
  if(id==='tent') return CUST_TENT_LOAD_IDS.slice();
  if(id==='dump') return CUST_DUMP_LOAD_IDS.slice();
  if(CUST_REAR_ONLY_VEHICLE_TYPES.has(id)) return id==='van'?['rear','tail_lift']:['rear'];
  if(id==='isotherm') return ['rear','tail_lift'];
  if(['board','open','platform','shalanda'].includes(id)) return CUST_OPEN_LOAD_IDS.slice();
  return ['top','side','rear','tail_lift','ramps'];
}
function custUnloadMethodsForBodyType(vtype){
  return custLoadMethodsForBodyType(vtype);
}
function custLoadMethodsForVehicleTypes(types){
  const ids=(types||[]).filter(Boolean);
  if(!ids.length) return [];
  const set=new Set();
  ids.forEach(v=>custLoadMethodsForBodyType(v).forEach(x=>set.add(x)));
  return CUST_LOAD_METHODS.filter(m=>set.has(m.id)).map(m=>m.id);
}
function custUnloadMethodsForVehicleTypes(types){
  return custLoadMethodsForVehicleTypes(types);
}
function yandexMapsApiKey(){
  return String((state.settings&&state.settings.yandexMapsApiKey)||'').trim();
}
const CUST_PACKAGING_TYPES=[
  {id:'pallets', label:'Паллеты'},
  {id:'boxes', label:'Короба / места'},
  {id:'bulk', label:'Россыпь / навал'},
  {id:'oversize', label:'Негабарит'},
  {id:'other', label:'Другое'}
];
function custPackagingLabel(id){
  return (CUST_PACKAGING_TYPES.find(x=>x.id===id)||{}).label||'';
}
function custVehicleTypeLabel(id){
  const hit=CUST_CLOSED_VEHICLE_TYPES.find(x=>x.id===id);
  if(hit) return hit.label;
  const refr=CUST_REFR_VEHICLE_TYPES.find(x=>x.id===id);
  if(refr) return refr.label;
  const open=CUST_OPEN_VEHICLE_TYPES.find(x=>x.id===id);
  if(open) return open.label;
  if(id===CUST_ISOTHERM_VEHICLE_TYPE.id) return CUST_ISOTHERM_VEHICLE_TYPE.label;
  return bodyTypeInputLabel(id)||id;
}
function custLoadMethodLabel(id){
  return (CUST_LOAD_METHODS.find(x=>x.id===id)||{}).label||id;
}
function custUnloadMethodLabel(id){
  return custLoadMethodLabel(id);
}
const CARGO_KINDS=[
  {id:'general', label:'Обычный груз'},
  {id:'food', label:'Продукты'},
  {id:'bulk', label:'Навалочный / сыпучий'},
  {id:'other', label:'Другое'}
];
function bodyTypeLabel(id){
  return (BODY_TYPES.find(x=>x.id===id)||{}).label||'';
}
/** Группа (tent/board/reefer/dump) и точный id типа кузова для матчинга. */
function bodyTypeMatchMeta(id){
  const x=String(id||'').trim();
  if(!x) return null;
  const ati=ATI_BODY_TYPES.find(t=>t.id===x);
  if(ati) return { id:ati.id, group:ati.mapTo||'board' };
  const coarse=BODY_TYPES.find(t=>t.id===x);
  if(coarse) return { id:coarse.id, group:coarse.id };
  return { id:x, group:mapVtypeToBodyType(x) };
}
function bodyTypeOrderMatch(a, b){
  if(!a||!b) return false;
  if(a===b) return true;
  const ma=bodyTypeMatchMeta(a);
  const mb=bodyTypeMatchMeta(b);
  if(!ma||!mb) return false;
  if(ma.id===mb.id) return true;
  if(ma.group===mb.group) return true;
  return false;
}
/** ТС подходит по типу кузова: vehicleTypeIds или reqBodyType (точный id или группа tent/board/reefer/dump). */
function vehicleBodyTypeMatchesOrder(v, o){
  if(!v||!o) return false;
  const vtypes=Array.isArray(o.vehicleTypeIds)?o.vehicleTypeIds.filter(Boolean):[];
  const req=String(o.reqBodyType||'').trim();
  if(!vtypes.length && !req) return true;
  const vid=String(v.bodyTypeId||'').trim();
  if(!vid) return false;
  if(vtypes.length) return vtypes.some(tid=>bodyTypeOrderMatch(tid, vid));
  return bodyTypeOrderMatch(req, vid);
}
const VEHICLE_ASSIGN_BLOCK_PARAM_KEYS=['госномер','тип кузова','грузоподъёмность'];
const VEHICLE_DIMENSION_PARAM_KEYS=['длина кузова','ширина кузова','высота кузова'];
/** Незаполненные обязательные параметры ТС (справочник «Авто», полный список). */
function vehicleMissingRequiredParams(v){
  if(!v) return VEHICLE_ASSIGN_BLOCK_PARAM_KEYS.concat(VEHICLE_DIMENSION_PARAM_KEYS);
  const miss=[];
  if(!String(v.plate||'').trim()) miss.push('госномер');
  if(!String(v.bodyTypeId||'').trim()) miss.push('тип кузова');
  if(!(+v.payloadTons>0)) miss.push('грузоподъёмность');
  if(!(+v.bodyLengthM>0)) miss.push('длина кузова');
  if(!(+v.bodyWidthM>0)) miss.push('ширина кузова');
  if(!(+v.bodyHeightM>0)) miss.push('высота кузова');
  return miss;
}
/** Без этого назначать нельзя (госномер, тип, тоннаж). */
function vehicleMissingAssignBlockParams(v){
  return vehicleMissingRequiredParams(v).filter(k=>VEHICLE_ASSIGN_BLOCK_PARAM_KEYS.includes(k));
}
function vehicleHasMissingDimensions(v){
  if(!v) return true;
  return !(+v.bodyLengthM>0) || !(+v.bodyWidthM>0) || !(+v.bodyHeightM>0);
}
function vehicleAssignDimensionWarnHint(v){
  return vehicleHasMissingDimensions(v)?'Габариты не указаны — проверьте вручную':'';
}
const VEHICLE_REQUIRED_PARAM_PHRASE={
  'госномер':'нет госномера',
  'тип кузова':'нет типа кузова',
  'грузоподъёмность':'нет грузоподъёмности',
  'длина кузова':'нет длины кузова',
  'ширина кузова':'нет ширины кузова',
  'высота кузова':'нет высоты кузова'
};
/** «нет типа кузова, …» — из vehicleMissingRequiredParams. */
function vehicleMissingRequiredPhrases(v){
  return vehicleMissingRequiredParams(v).map(k=>VEHICLE_REQUIRED_PARAM_PHRASE[k]||('нет '+k));
}
/** Пометка для назначения / подбора ТС (только блокирующие поля). */
function vehicleAssignBlockHint(v){
  const parts=vehicleMissingAssignBlockParams(v).map(k=>VEHICLE_REQUIRED_PARAM_PHRASE[k]||('нет '+k));
  return parts.length?('⚠ Нельзя назначить: '+parts.join(', ')):'';
}
function vehicleRequiredParamsMessage(missing){
  const m=Array.isArray(missing)?missing.filter(Boolean):vehicleMissingRequiredParams(missing);
  return m.length?`Заполните: ${m.join(', ')}`:'';
}
function orderHasVehicleRequirements(o){
  if(!o) return false;
  if(+(o.reqPayloadTons)>0) return true;
  if(+(o.reqLengthM)>0||+(o.reqWidthM)>0||+(o.reqHeightM)>0) return true;
  if(String(o.reqBodyType||'').trim()) return true;
  if(Array.isArray(o.vehicleTypeIds)&&o.vehicleTypeIds.some(Boolean)) return true;
  return false;
}
function cargoKindLabel(id){
  return (CARGO_KINDS.find(x=>x.id===id)||{}).label||'';
}
function tripModeLabel(id){
  if(id==='intercity') return 'Межгород';
  if(id==='suburb') return 'Пригород';
  return 'Город';
}
const _geoCache=new Map();
function haversineKm(a, b){
  if(!a||!b) return null;
  const R=6371;
  const dLat=(b.lat-a.lat)*Math.PI/180;
  const dLon=(b.lon-a.lon)*Math.PI/180;
  const x=Math.sin(dLat/2)**2 + Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLon/2)**2;
  const km=2*R*Math.asin(Math.min(1, Math.sqrt(x)));
  return km>0?km:null;
}
function formatNominatimAddress(hit){
  const a=hit&&hit.address||{};
  const city=a.city||a.town||a.village||a.municipality||a.state||'';
  const road=a.road||a.pedestrian||a.street||a.footway||'';
  const house=a.house_number||'';
  const parts=[];
  if(city) parts.push(city);
  if(road) parts.push(road);
  if(house) parts.push(house);
  if(parts.length>=2) return parts.join(', ');
  const dn=String(hit&&hit.display_name||'').trim();
  if(!dn) return '';
  return dn.replace(/, Россия$/,'').replace(/, \d{6}$/,'').trim();
}
const _suggestCache=new Map();
async function suggestAddresses(q, limit=6){
  const query=String(q||'').trim();
  if(query.length<3) return [];
  const lim=Math.max(1, Math.min(10, +limit||6));
  const key=query.toLowerCase()+'|'+lim;
  if(_suggestCache.has(key)) return _suggestCache.get(key);
  try{
    const url=`/geo-nominatim/search?format=json&limit=${lim}&addressdetails=1&countrycodes=ru&q=${encodeURIComponent(query)}`;
    const res=await fetch(url, {headers:{Accept:'application/json'}});
    if(!res.ok) return [];
    const arr=await res.json();
    const seen=new Set();
    const out=[];
    for(const hit of (arr||[])){
      const label=formatNominatimAddress(hit);
      const lat=+hit.lat, lon=+hit.lon;
      if(!label || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const dedupe=label.toLowerCase();
      if(seen.has(dedupe)) continue;
      seen.add(dedupe);
      _geoCache.set(dedupe, {lat, lon});
      out.push({label, lat, lon});
    }
    _suggestCache.set(key, out);
    return out;
  }catch(_){ return []; }
}
async function geocodeAddress(q){
  const query=String(q||'').trim();
  if(query.length<4) return null;
  const key=query.toLowerCase();
  if(_geoCache.has(key)) return _geoCache.get(key);
  try{
    const sug=await suggestAddresses(query, 1);
    if(sug[0]) return {lat:sug[0].lat, lon:sug[0].lon};
    return null;
  }catch(_){ return null; }
}
function wireAddressAutocomplete(input, opts){
  if(!input || input.dataset.addrSuggestWired) return;
  input.dataset.addrSuggestWired='1';
  input.setAttribute('autocomplete','off');
  const minLen=Math.max(2, +(opts&&opts.minLen)||3);
  const debounceMs=Math.max(150, +(opts&&opts.debounceMs)||350);
  const wrap=document.createElement('div');
  wrap.className='addr-suggest-wrap';
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);
  const list=document.createElement('div');
  list.className='addr-suggest-list';
  list.hidden=true;
  list.setAttribute('role','listbox');
  wrap.appendChild(list);
  let timer=null, reqId=0, items=[], activeIdx=-1;
  const onSelect=(item)=>{
    if(!item) return;
    input.value=item.label;
    input.dataset.lat=String(item.lat);
    input.dataset.lon=String(item.lon);
    list.hidden=true;
    activeIdx=-1;
    items=[];
    if(opts&&typeof opts.onSelect==='function') opts.onSelect(item);
    input.dispatchEvent(new Event('change',{bubbles:true}));
  };
  const paintList=(suggestions)=>{
    items=suggestions;
    activeIdx=-1;
    list.innerHTML='';
    if(!suggestions.length){ list.hidden=true; return; }
    suggestions.forEach((s,i)=>{
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='addr-suggest-item';
      btn.setAttribute('role','option');
      btn.dataset.idx=String(i);
      btn.textContent=s.label;
      btn.onmousedown=e=>{ e.preventDefault(); onSelect(items[+btn.dataset.idx]); };
      list.appendChild(btn);
    });
    list.hidden=false;
  };
  const highlight=()=>{
    list.querySelectorAll('.addr-suggest-item').forEach((el,i)=>{
      el.classList.toggle('is-active', i===activeIdx);
      if(i===activeIdx) el.scrollIntoView({block:'nearest'});
    });
  };
  const fetchSuggestions=async()=>{
    const q=input.value.trim();
    if(q.length<minLen){ paintList([]); return; }
    const id=++reqId;
    const sug=await suggestAddresses(q);
    if(id!==reqId || input.value.trim()!==q) return;
    paintList(sug);
  };
  input.addEventListener('input', ()=>{
    delete input.dataset.lat;
    delete input.dataset.lon;
    clearTimeout(timer);
    timer=setTimeout(fetchSuggestions, debounceMs);
    if(opts&&typeof opts.onInput==='function') opts.onInput();
  });
  input.addEventListener('keydown', e=>{
    if(list.hidden || !items.length) return;
    if(e.key==='ArrowDown'){ e.preventDefault(); activeIdx=Math.min(activeIdx+1, items.length-1); highlight(); }
    else if(e.key==='ArrowUp'){ e.preventDefault(); activeIdx=Math.max(activeIdx-1, 0); highlight(); }
    else if(e.key==='Enter' && activeIdx>=0){ e.preventDefault(); onSelect(items[activeIdx]); }
    else if(e.key==='Escape'){ list.hidden=true; activeIdx=-1; }
  });
  input.addEventListener('blur', ()=>{
    setTimeout(()=>{ list.hidden=true; if(opts&&typeof opts.onBlur==='function') opts.onBlur(); }, 160);
  });
  input.addEventListener('focus', ()=>{
    if(input.value.trim().length>=minLen) fetchSuggestions();
  });
}
async function estimateRouteKm(fromAddr, toAddr){
  const g=await estimateRouteGeometry(fromAddr, toAddr);
  return g&&g.km>0?g.km:null;
}
async function estimateRouteGeometry(fromAddr, toAddr){
  const a=await geocodeAddress(fromAddr);
  const b=await geocodeAddress(toAddr);
  if(!a||!b) return null;
  try{
    const url=`/osrm-route/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=full&geometries=geojson&steps=false`;
    const res=await fetch(url, {headers:{Accept:'application/json'}});
    if(res.ok){
      const data=await res.json();
      const route=data&&data.routes&&data.routes[0];
      const m=route&&route.distance;
      const coords=route&&route.geometry&&route.geometry.coordinates;
      if(m>50){
        return {
          km:Math.max(1, Math.round(m/1000)),
          from:a, to:b,
          coordinates:Array.isArray(coords)?coords:[]
        };
      }
    }
  }catch(_){}
  const straight=haversineKm(a,b);
  if(!(straight>0)) return null;
  return {
    km:Math.max(1, Math.round(straight*1.35)),
    from:a, to:b,
    coordinates:[[a.lon,a.lat],[b.lon,b.lat]]
  };
}
const DEFAULT_OWN_COMPANIES=[
  {name:"ООО «Армада»", roles:["own"], note:"Оператор платформы — свой кабинет"}
];
const DEFAULT_ADMINS=[
  {id:"admin-super", name:"Наволоцкий Е.Н.", pin:"", isSuper:true}
];
/** Старые тестовые учётки — вычищаем при каждой миграции, даже если старый браузер вернул их с кэша */
const RETIRED_ADMIN_IDS=new Set(["admin-dispatcher"]);
const RETIRED_ADMIN_NAMES=new Set(["диспетчер"]);
/** Дубликат заказа Наволоцкого на ИП Нечаев — не воскрешать из кэша вкладок */
const RETIRED_ORDER_IDS=new Set(["2b08ea51-8d08-4377-8f0d-80aa3b417dda"]);
const DRIVER_INVITE_TTL_MS=7*24*60*60*1000;
const KEY="armada_app_v5";
const OLD_KEY="armada_app_v4";
/** Этап 6: узкий кэш вместо полного state (без PIN и чужих кабинетов). */
const LOCAL_CACHE_KEY="armada_local_cache_v1";
const DEVICE_KEY="armada_admin_device";
const ADMIN_SESSION_KEY="armada_admin_session_v1";
/** PIN подтверждён в этой вкладке (для /a — не пускать без PIN). */
const ADMIN_PIN_OK_KEY="armada_admin_pin_ok_v1";
/** @deprecated legacy — миграция в role/sync ключи при первом чтении */
const ARMADA_API_TOKEN_KEY="armada_api_token_v1";
const ARMADA_API_ROLE_TOKEN_KEY="armada_api_role_token_v1";
const ARMADA_API_SYNC_TOKEN_KEY="armada_api_sync_token_v1";
const LAST_ROLE_KEY="armada_last_role_v1";
const PRESENCE_ONLINE_MS=90*1000;
const PRESENCE_TICK_MS=25*1000;
const AUTO_SYNC_MS=55*1000;
const AUTO_SYNC_SLOW_MS=70*1000;
const FETCH_TIMEOUT_MS=8000;
const PATCH_TIMEOUT_MS=25000;
const FETCH_PREFLIGHT_MS=4000;
const INIT_FETCH_MS=3500;
const PERSIST_DEBOUNCE_MS=2200;
const SYNC_BACKOFF_MAX_MS=90000;
/** UUID без HTTPS: crypto.randomUUID на http:// часто недоступен и ломал «Открыть смену». */
function uuid(){
  try{
    const c=globalThis.crypto;
    if(c&&typeof c.randomUUID==='function'){
      return c.randomUUID.call(c);
    }
  }catch(_){}
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{
    const r=Math.random()*16|0;
    const v=c==='x'?r:(r&0x3|0x8);
    return v.toString(16);
  });
}
/** Единый формат: +7XXXXXXXXXX — order.html грузит только store.js (без app.js). */
function formatPhone(raw){
  let d=String(raw??'').replace(/\D/g,'');
  if(!d) return '';
  if(d.length===11 && d[0]==='8') d='7'+d.slice(1);
  if(d.length===10) d='7'+d;
  if(d.length===11 && d[0]==='7') return '+'+d;
  if(d.length>11 && d[0]==='7') return '+'+d.slice(0,11);
  if(d.length>=10) return '+7'+d.slice(-10);
  return '';
}
function numOrNull(raw){
  const n=+String(raw??'').replace(',','.');
  return (n>0 && !Number.isNaN(n))?n:null;
}
/** Минимальная нормализация ТС для initCloudSync на публичной форме. */
function normalizeFleetVehicle(v){
  if(!v) return null;
  const plate=String(v.plate||'').trim();
  if(!plate) return null;
  const out={
    id:v.id||uuid(),
    plate,
    consumptionPer100Km:(+v.consumptionPer100Km>0)?+v.consumptionPer100Km:20,
    makeModel:String(v.makeModel||'').trim(),
    payloadTons:numOrNull(v.payloadTons),
    bodyLengthM:numOrNull(v.bodyLengthM),
    bodyWidthM:numOrNull(v.bodyWidthM),
    bodyHeightM:numOrNull(v.bodyHeightM),
    bodyTypeId:v.bodyTypeId?String(v.bodyTypeId).trim():null,
    hasTrailer:!!v.hasTrailer,
    trailerPlate:v.hasTrailer?String(v.trailerPlate||'').trim():'',
    spaceId:v.spaceId||null,
    companyId:v.companyId||null,
    companyName:v.companyName||null,
    currentOdometer:numOrNull(v.currentOdometer),
    stsSeries:String(v.stsSeries||'').trim(),
    stsNumber:String(v.stsNumber||'').trim(),
    stsPhoto:v.stsPhoto||null,
    assignedDriverIds:(Array.isArray(v.assignedDriverIds)?v.assignedDriverIds:[]).map(String).filter(Boolean),
    crewName:String(v.crewName||'').trim(),
    serviceIntervals:Array.isArray(v.serviceIntervals)?v.serviceIntervals:[],
    maintenanceLogs:Array.isArray(v.maintenanceLogs)?v.maintenanceLogs:[]
  };
  if(v.modelId) out.modelId=String(v.modelId).trim();
  if(v.catalogType) out.catalogType=String(v.catalogType).trim();
  if(v.catalogCorrectedByOwner) out.catalogCorrectedByOwner=true;
  if(v.catalogBenchmark&&typeof v.catalogBenchmark==='object') out.catalogBenchmark=v.catalogBenchmark;
  if(v.axles!=null&&+v.axles>0) out.axles=+v.axles;
  if(v.enginePower!=null&&+v.enginePower>0) out.enginePower=+v.enginePower;
  if(v.crane&&typeof v.crane==='object') out.crane=v.crane;
  if(v.rates===null) out.rates=null;
  else if(v.rates&&typeof v.rates==='object') out.rates=v.rates;
  if(v.schedule&&typeof v.schedule==='object') out.schedule=v.schedule;
  if(v.location&&typeof v.location==='object') out.location=v.location;
  if(v.rating&&typeof v.rating==='object') out.rating=v.rating;
  const fr=typeof globalThis!=='undefined'?globalThis.armadaFleetRates:null;
  if(fr&&fr.normalizeVehicleFleetMeta){
    if(out.rates===null) fr.normalizeVehicleFleetMeta(Object.assign({}, out, {rates:null}));
    else fr.normalizeVehicleFleetMeta(out);
  }
  return out;
}
function migrateStagingSpaceOwnCompany(){
  let changed=false;
  const sp=(state.spaces||[]).find(s=>s&&s.id==='staging-space');
  const canonicalId='staging-company';
  if(sp){
    if(sp.ownCompanyId!==canonicalId){
      sp.ownCompanyId=canonicalId;
      changed=true;
    }
    const before=(state.companies||[]).length;
    state.companies=(state.companies||[]).filter(c=>{
      if(!c||c.spaceId!==sp.id||c.id===canonicalId) return true;
      if(typeof isSpaceShadowCompany==='function'&&isSpaceShadowCompany(c)){
        changed=true;
        return false;
      }
      return true;
    });
    if((state.companies||[]).length!==before) changed=true;
    const co=findCompanyById(canonicalId);
    if(co){
      const roles=(co.roles||[]).slice();
      if(!roles.includes('own')){ roles.push('own'); changed=true; }
      if(!roles.includes('carrier')){ roles.push('carrier'); changed=true; }
      if(roles.join()!==(co.roles||[]).join()) co.roles=roles;
      if(co.spaceId!==sp.id){ co.spaceId=sp.id; changed=true; }
    }
  }
  return changed;
}
function migrateRolesTariffsFinal(){
  let changed=false;
  if(typeof migrateStagingSpaceOwnCompany==='function'&&migrateStagingSpaceOwnCompany()) changed=true;
  const fr=typeof globalThis!=='undefined'?globalThis.armadaFleetRates:null;
  (state.companies||[]).forEach(c=>{
    const roles=c.roles||[];
    if((roles.includes('own')||roles.includes('carrier'))&&fr&&fr.buildCompanyRatesByTypeFromVehicles){
      if(fr.buildCompanyRatesByTypeFromVehicles(c, state.vehicles||[])) changed=true;
    }
    if(fr&&fr.normalizeCompanyRatesByType&&fr.normalizeCompanyRatesByType(c)) changed=true;
  });
  (state.vehicles||[]).forEach(v=>{
    if(!v) return;
    const vid=String(v.id||'');
    const staging=vid.startsWith('staging-vehicle-')||(v.companyId==='staging-company'&&v.spaceId==='staging-space');
    if(staging&&v.rates!=null){ v.rates=null; changed=true; }
  });
  (state.orders||[]).forEach(o=>{
    if(typeof syncOrderPricingFields==='function'&&syncOrderPricingFields(o)) changed=true;
  });
  return changed;
}
function normalizeAllPhones(){
  let changed=false;
  const fix=v=>{
    const f=formatPhone(v);
    if(!v && !f) return v||'';
    if(f && f!==v){ changed=true; return f; }
    return v||'';
  };
  (state.drivers||[]).forEach(d=>{
    const next=fix(d.phone);
    if(next!==(d.phone||'')) d.phone=next;
  });
  (state.companies||[]).forEach(c=>{
    (c.phones||[]).forEach(p=>{ if(p && p.number!=null){ const n=fix(p.number); if(n!==p.number) p.number=n; } });
    (c.contacts||[]).forEach(ct=>{
      (ct.phones||[]).forEach(p=>{ if(p && p.number!=null){ const n=fix(p.number); if(n!==p.number) p.number=n; } });
      if(ct.phone){ const n=fix(ct.phone); if(n!==ct.phone){ ct.phone=n; changed=true; } }
    });
    (c.drivers||[]).forEach(d=>{
      const n=fix(d.phone); if(n!==(d.phone||'')) d.phone=n;
    });
  });
  (state.orders||[]).forEach(o=>{
    if(o.contactPhone!=null){ const n=fix(o.contactPhone); if(n!==o.contactPhone){ o.contactPhone=n; changed=true; } }
    if(o.loadingContactPhone!=null){ const n=fix(o.loadingContactPhone); if(n!==o.loadingContactPhone){ o.loadingContactPhone=n; changed=true; } }
    if(o.unloadingContactPhone!=null){ const n=fix(o.unloadingContactPhone); if(n!==o.unloadingContactPhone){ o.unloadingContactPhone=n; changed=true; } }
    if(o.driverPhone!=null){ const n=fix(o.driverPhone); if(n!==o.driverPhone){ o.driverPhone=n; changed=true; } }
    if(o.transportApp && o.transportApp.driverPhone!=null){
      const n=fix(o.transportApp.driverPhone);
      if(n!==o.transportApp.driverPhone){ o.transportApp.driverPhone=n; changed=true; }
    }
  });
  return changed;
}
/** Общая база на VPS; с GitHub Pages тоже ходим сюда (нужен HTTP-сайт приложения). */
const PB_BASE=(function(){
  const h=location.hostname;
  if(isArmadaProdHost(h)) return location.origin;
  return ARMADA_LIVE_ORIGIN;
})();
console.info("АРМАДА build", APP_BUILD, "PB", PB_BASE);
function loadInitialLocalPayload(){
  try{
    const cacheRaw=localStorage.getItem(LOCAL_CACHE_KEY);
    if(cacheRaw){
      const p=JSON.parse(cacheRaw);
      if(p&&p.cacheVersion===1) return p;
    }
  }catch(_){}
  try{
    return JSON.parse(localStorage.getItem(KEY)||localStorage.getItem(OLD_KEY)||"{}");
  }catch(_){ return {}; }
}
const saved=loadInitialLocalPayload();
const DEFAULT_FINANCE={markupPercent:15,cityKmThreshold:100,suburbKmThreshold:30,minWorkHours:4,podachaHours:1,podachaEmptyKmLimit:20,defaultRatePerHourWork:0,defaultRatePerKmCash:80,ratePerKmOutsideKad:0,payloadFromTons:0,bodyMultReefer:1.25,bodyMultDump:1.15,heavyTonsFrom:20,heavyMult:1.15,logistFeePercent:10};
function clampMult(v, fallback){
  const n=+v;
  if(!(n>0) || Number.isNaN(n)) return fallback;
  return Math.min(2.5, Math.max(1, n));
}
function normalizeFinance(f){
  const s=Object.assign({}, DEFAULT_FINANCE, f||{});
  let markup=+s.markupPercent; if(Number.isNaN(markup)) markup=15;
  s.markupPercent=Math.min(80, Math.max(0, markup));
  s.cityKmThreshold=(+s.cityKmThreshold>0)?+s.cityKmThreshold:100;
  s.suburbKmThreshold=(+s.suburbKmThreshold>0)?+s.suburbKmThreshold:30;
  s.minWorkHours=(+s.minWorkHours>=0)?+s.minWorkHours:4;
  s.podachaHours=(+s.podachaHours>=0)?+s.podachaHours:1;
  s.podachaEmptyKmLimit=(+s.podachaEmptyKmLimit>0)?+s.podachaEmptyKmLimit:20;
  s.defaultRatePerHourWork=(+s.defaultRatePerHourWork>0)?+s.defaultRatePerHourWork:0;
  s.defaultRatePerKmCash=(+s.defaultRatePerKmCash>0)?+s.defaultRatePerKmCash:80;
  s.ratePerKmOutsideKad=(+s.ratePerKmOutsideKad>0)?+s.ratePerKmOutsideKad:0;
  s.payloadFromTons=(+s.payloadFromTons>0)?+s.payloadFromTons:0;
  s.payloadToTons=(+s.payloadToTons>0)?+s.payloadToTons:5;
  s.lengthFromM=(+s.lengthFromM>0)?+s.lengthFromM:0;
  s.lengthToM=(+s.lengthToM>0)?+s.lengthToM:0;
  s.bodyMultReefer=clampMult(s.bodyMultReefer, 1.25);
  s.bodyMultDump=clampMult(s.bodyMultDump, 1.15);
  s.heavyTonsFrom=(+s.heavyTonsFrom>0)?+s.heavyTonsFrom:20;
  s.heavyMult=clampMult(s.heavyMult, 1.15);
  let fee=+s.logistFeePercent; if(Number.isNaN(fee)) fee=10;
  s.logistFeePercent=Math.min(40, Math.max(0, fee));
  const byType={};
  const src=f&&f.byType&&typeof f.byType==='object'?f.byType:{};
  Object.keys(src).forEach(id=>{
    const row=src[id];
    if(!row||typeof row!=='object') return;
    const rate=+row.ratePerHour;
    if(!(rate>0)) return;
    const hours=+row.minWorkHours;
    const podacha=+row.podachaHours;
    const km=+row.cityKmThreshold;
    const perKm=+row.ratePerKm;
    const emptyLim=+row.podachaEmptyKmLimit;
    const kad=+row.ratePerKmKad;
    const fromTons=+row.payloadFromTons;
    const toTons=+row.payloadToTons;
    const lenFrom=+row.lengthFromM;
    const lenTo=+row.lengthToM;
    byType[String(id)]={
      ratePerHour:rate,
      payloadFromTons:(row.payloadFromTons===''||row.payloadFromTons==null||!(fromTons>0))?0:fromTons,
      payloadToTons:(row.payloadToTons===''||row.payloadToTons==null||!(toTons>0))?0:toTons,
      lengthFromM:(row.lengthFromM===''||row.lengthFromM==null||!(lenFrom>0))?0:lenFrom,
      lengthToM:(row.lengthToM===''||row.lengthToM==null||!(lenTo>0))?0:lenTo,
      minWorkHours:(row.minWorkHours===''||row.minWorkHours==null||Number.isNaN(hours))?s.minWorkHours:hours,
      podachaHours:(row.podachaHours===''||row.podachaHours==null||Number.isNaN(podacha))?s.podachaHours:podacha,
      podachaEmptyKmLimit:(row.podachaEmptyKmLimit===''||row.podachaEmptyKmLimit==null||!(emptyLim>0))?s.podachaEmptyKmLimit:emptyLim,
      cityKmThreshold:(row.cityKmThreshold===''||row.cityKmThreshold==null||!(km>0))?s.cityKmThreshold:km,
      ratePerKm:(row.ratePerKm===''||row.ratePerKm==null||!(perKm>0))?s.defaultRatePerKmCash:perKm,
      ratePerKmKad:(row.ratePerKmKad===''||row.ratePerKmKad==null||!(kad>0))?0:kad
    };
  });
  s.byType=byType;
  const normRule=(row,fallbackBody)=>{
    if(!row||typeof row!=='object') return null;
    const rate=+row.ratePerHour;
    const body=String(row.bodyTypeId||fallbackBody||'').trim();
    return {
      id:String(row.id||fallbackBody||uuid()).slice(0,40),
      bodyTypeId:body,
      payloadFromTons:(+row.payloadFromTons>0)?+row.payloadFromTons:0,
      payloadToTons:(+row.payloadToTons>0)?+row.payloadToTons:0,
      lengthFromM:(+row.lengthFromM>0)?+row.lengthFromM:0,
      lengthToM:(+row.lengthToM>0)?+row.lengthToM:0,
      widthM:(+row.widthM>0)?+row.widthM:0,
      heightM:(+row.heightM>0)?+row.heightM:0,
      ratePerHour:(rate>0)?rate:0,
      minWorkHours:(+row.minWorkHours>=0)?+row.minWorkHours:s.minWorkHours,
      podachaHours:(+row.podachaHours>=0)?+row.podachaHours:s.podachaHours,
      podachaEmptyKmLimit:(+row.podachaEmptyKmLimit>0)?+row.podachaEmptyKmLimit:s.podachaEmptyKmLimit,
      cityKmThreshold:(+row.cityKmThreshold>0)?+row.cityKmThreshold:s.cityKmThreshold,
      ratePerKm:(+row.ratePerKm>0)?+row.ratePerKm:s.defaultRatePerKmCash,
      ratePerKmKad:(+row.ratePerKmKad>0)?+row.ratePerKmKad:0
    };
  };
  let tariffRules=Array.isArray(f&&f.tariffRules)?f.tariffRules.map(r=>normRule(r)).filter(Boolean):[];
  if(!tariffRules.length){
    Object.keys(byType).forEach(id=>{ const r=normRule(byType[id], id); if(r) tariffRules.push(r); });
  }
  s.tariffRules=tariffRules;
  return s;
}
/** Параметры для тарифа = требования груза; после назначения ТС — подставляем машину, если в заявке пусто. */
function orderTariffDimensions(o){
  if(!o) return {bodyGroup:'board', bodyTypeId:'', payloadTons:0, lengthM:0};
  let payloadTons=+o.reqPayloadTons||0;
  let lengthM=+o.reqLengthM||0;
  const assigned=(o.vehiclePlate&&typeof vehicle==='function')?vehicle(o.vehiclePlate, o.ownCompanyId||null):null;
  if(assigned){
    if(!(payloadTons>0)&&+assigned.payloadTons>0) payloadTons=+assigned.payloadTons;
    if(!(lengthM>0)&&+assigned.bodyLengthM>0) lengthM=+assigned.bodyLengthM;
  }
  let widthM=+o.reqWidthM||0;
  let heightM=+o.reqHeightM||0;
  if(assigned){
    if(!(widthM>0)&&+assigned.bodyWidthM>0) widthM=+assigned.bodyWidthM;
    if(!(heightM>0)&&+assigned.bodyHeightM>0) heightM=+assigned.bodyHeightM;
  }
  let vtypeId='';
  if(Array.isArray(o.vehicleTypeIds)&&o.vehicleTypeIds[0]) vtypeId=String(o.vehicleTypeIds[0]).trim();
  else if(o.vehicleTypeId) vtypeId=String(o.vehicleTypeId).trim();
  const bodyGroup=String(o.reqBodyType||'').trim()||mapVtypeToBodyType(vtypeId)||(assigned&&assigned.bodyTypeId)||'board';
  return {bodyGroup, bodyTypeId:vtypeId||bodyGroup, payloadTons, lengthM, widthM, heightM};
}
const TARIFF_UI_GROUP_ORDER={board:0, tent:1, van:2, reefer:3, dump:4, other:99};
/** Группа для списка карточек тарифа в кабинете (борт / тент / фургон …). */
function tariffRuleUiGroup(bodyTypeId){
  const id=String(bodyTypeId||'').trim().toLowerCase();
  if(id==='van') return {key:'van', label:'Фургоны'};
  if(id==='tent') return {key:'tent', label:'Тент'};
  const g=typeof mapVtypeToBodyType==='function'?mapVtypeToBodyType(id):'board';
  if(g==='tent') return {key:'tent', label:'Тент'};
  if(g==='board') return {key:'board', label:'Бортовые'};
  if(g==='reefer') return {key:'reefer', label:'Рефрижераторы'};
  if(g==='dump') return {key:'dump', label:'Самосвалы'};
  return {key:'other', label:'Прочее'};
}
function tariffRuleDimSort(rule){
  const r=rule||{};
  const len=+(r.lengthFromM||0)||+(r.lengthToM||0);
  return [len, +(r.widthM||0), +(r.heightM||0)];
}
function compareTariffRulesForUi(a,b){
  const c=tariffRuleDimSort(a);
  const d=tariffRuleDimSort(b);
  for(let i=0;i<3;i++){ if(c[i]!==d[i]) return c[i]-d[i]; }
  return String(a.bodyTypeId||'').localeCompare(String(b.bodyTypeId||''),'ru');
}
function groupTariffRulesForUi(rules){
  const map=new Map();
  (rules||[]).forEach(r=>{
    if(!r) return;
    const g=tariffRuleUiGroup(r.bodyTypeId);
    if(!map.has(g.key)) map.set(g.key, {key:g.key, label:g.label, rules:[]});
    map.get(g.key).rules.push(r);
  });
  const out=[...map.values()];
  out.forEach(gr=>gr.rules.sort(compareTariffRulesForUi));
  out.sort((a,b)=>(TARIFF_UI_GROUP_ORDER[a.key]??99)-(TARIFF_UI_GROUP_ORDER[b.key]??99));
  return out;
}
/** Иконка «два листочка» (копировать) — как в чате заказчика. */
function copySheetsIconHtml(size){
  const s=+size>0?+size:16;
  return `<svg class="icon-copy-sheets" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
}
function formatTariffDimRu(n){
  if(n===''||n==null||n===undefined) return '∞';
  const x=+n;
  if(Number.isNaN(x)) return String(n);
  const s=String(x).replace('.', ',');
  return s;
}
function formatRuDecimalNumber(n, opts){
  opts=opts||{};
  const x=+n;
  if(Number.isNaN(x)) return String(n||'');
  if(!(x>0) && !(opts.allowZero && x===0)) return '';
  let frac=opts.frac;
  if(frac==null){
    if(x>=100) frac=0;
    else if(x>=1) frac=(x%1===0?0:1);
    else frac=2;
  }
  const raw=frac===0?String(Math.round(x)):x.toFixed(frac);
  return raw.replace('.', ',');
}
function formatCargoWeightKgRu(kg){
  const k=+kg;
  if(!(k>0)) return '';
  return `${formatRuDecimalNumber(Math.round(k), {frac:0})} кг`;
}
function formatVolumeM3Ru(m3, opts){
  opts=opts||{};
  const v=+m3;
  if(!(v>0)) return '';
  return `${formatRuDecimalNumber(v, {frac:opts.frac!=null?opts.frac:1})} м³`;
}
function formatCargoDimRuM(n){
  const v=+n;
  if(!(v>0)) return '';
  return `${formatRuDecimalNumber(v, {frac:1})} м`;
}
function formatCargoWeightTonsRu(tons, opts){
  opts=opts||{};
  const t=+tons;
  if(!(t>0)) return '';
  const prefix=opts.fromMin?'от ':'';
  let frac=opts.frac;
  if(frac==null) frac=t>=1&&(t%1===0)?0:(t>=1?1:2);
  return `${prefix}${formatRuDecimalNumber(t, {frac})} т`;
}
/** Масса груза (кг) для UI: cargoWeightKg или reqPayloadTons у портальных заявок без kg на сервере. */
function orderDisplayCargoMassKg(o){
  if(!o) return null;
  const kg=+o.cargoWeightKg;
  if(kg>0) return Math.round(kg);
  const tons=+o.reqPayloadTons;
  if(!(tons>0)) return null;
  const isPortal=o.source==='armada_sx'||o.customerSubmitted||o.publicLeadId;
  if(!isPortal) return null;
  const vtid=(Array.isArray(o.vehicleTypeIds)&&o.vehicleTypeIds[0])||'';
  const def=ARMADA_SX_VTYPE_DEFAULT_REQS[vtid]||null;
  const defTons=def&&+def.reqPayloadTons||0;
  if(defTons>0 && Math.abs(tons-defTons)<0.001) return null;
  return Math.round(tons*1000);
}
function formatOrderCargoMassDisplay(o){
  const kg=orderDisplayCargoMassKg(o);
  if(kg>0) return formatCargoWeightKgRu(kg);
  return '';
}
/** Мин. грузоподъёмность ТС на карточке — не дублировать точную массу груза. */
function formatOrderVehiclePayloadMinDisplay(o){
  if(!o) return '';
  const tons=+o.reqPayloadTons;
  if(!(tons>0)) return '';
  const massKg=orderDisplayCargoMassKg(o);
  if(massKg>0 && Math.abs(tons*1000-massKg)<1) return '';
  const vtid=(Array.isArray(o.vehicleTypeIds)&&o.vehicleTypeIds[0])||'';
  const def=ARMADA_SX_VTYPE_DEFAULT_REQS[vtid]||null;
  const defTons=def&&+def.reqPayloadTons||0;
  const isPortal=o.source==='armada_sx'||o.customerSubmitted;
  if(isPortal && defTons>0 && Math.abs(tons-defTons)<0.001) return formatCargoWeightTonsRu(tons, {fromMin:true});
  if(massKg>0) return '';
  return formatCargoWeightTonsRu(tons, {fromMin:true});
}
function capitalizeRu(s){
  const t=String(s||'').trim();
  if(!t) return '—';
  return t.charAt(0).toUpperCase()+t.slice(1);
}
/** Заголовок карточки тарифа (кабинет + подсказки). */
function tariffRuleDisplayTitle(rule){
  const r=rule||{};
  const body=capitalizeRu(typeof bodyTypeInputLabel==='function'?bodyTypeInputLabel(r.bodyTypeId):r.bodyTypeId);
  const l0=+(r.lengthFromM||0);
  const l1=+(r.lengthToM||0);
  let lenPart='';
  if(l0>0&&l1>0&&Math.abs(l0-l1)<0.001) lenPart=` д ${formatTariffDimRu(l0)}`;
  else if(l0>0||l1>0) lenPart=` д ${formatTariffDimRu(l0||0)}–${l1>0?formatTariffDimRu(l1):'∞'}`;
  const w=+(r.widthM||0);
  const h=+(r.heightM||0);
  const wPart=w>0?` ш ${formatTariffDimRu(w)}`:'';
  const hPart=h>0?` в ${formatTariffDimRu(h)}`:'';
  const t0=+(r.payloadFromTons||0);
  const t1=+(r.payloadToTons||0);
  const pay=` грузоподъемность от ${formatTariffDimRu(t0)} до ${t1>0?formatTariffDimRu(t1):'∞'} т`;
  return `тип ТС ${body}${lenPart}${wPart}${hPart}${pay}`;
}
function tariffBodyGroupMatches(ruleBody, dims){
  const rb=String(ruleBody||'').trim();
  if(!rb) return true;
  const g=String(dims.bodyGroup||'').trim();
  const id=String(dims.bodyTypeId||'').trim();
  if(rb===g||rb===id) return true;
  if(id&&mapVtypeToBodyType(id)===rb) return true;
  if(g&&mapVtypeToBodyType(g)===rb) return true;
  return false;
}
function tariffDimInRange(val, from, to){
  const v=+val;
  if(!(v>0)) return true;
  const f=+from;
  const t=+to;
  if(f>0&&v+1e-9<f) return false;
  if(t>0&&v>t+1e-9) return false;
  return true;
}
function tariffRuleMatchesDims(rule, dims){
  if(!rule) return false;
  if(!tariffBodyGroupMatches(rule.bodyTypeId, dims)) return false;
  if(!(tariffDimInRange(dims.payloadTons, rule.payloadFromTons, rule.payloadToTons)
    && tariffDimInRange(dims.lengthM, rule.lengthFromM, rule.lengthToM))) return false;
  const rw=+(rule.widthM||0);
  const rh=+(rule.heightM||0);
  if(rw>0&&+(dims.widthM||0)>0&&Math.abs(dims.widthM-rw)>0.05) return false;
  if(rh>0&&+(dims.heightM||0)>0&&Math.abs(dims.heightM-rh)>0.05) return false;
  return true;
}
function tariffRuleSpecificity(rule){
  const t0=+(rule.payloadFromTons||0);
  const t1=+(rule.payloadToTons||0);
  const l0=+(rule.lengthFromM||0);
  const l1=+(rule.lengthToM||0);
  const tw=(t1>0&&t0>=0)?Math.max(0.001,t1-t0):999;
  const lw=(l1>0&&l0>=0)?Math.max(0.001,l1-l0):999;
  const body=rule.bodyTypeId?0:1;
  return body*1e6+tw*100+lw;
}
function tariffLightRuleFromBase(base){
  return {
    id:'__light__',
    bodyTypeId:'',
    payloadFromTons:base.payloadFromTons||0,
    payloadToTons:base.payloadToTons>0?base.payloadToTons:5,
    lengthFromM:base.lengthFromM||0,
    lengthToM:base.lengthToM||0,
    ratePerHour:base.defaultRatePerHourWork,
    minWorkHours:base.minWorkHours,
    podachaHours:base.podachaHours,
    podachaEmptyKmLimit:base.podachaEmptyKmLimit,
    cityKmThreshold:base.cityKmThreshold,
    ratePerKm:base.defaultRatePerKmCash,
    ratePerKmKad:base.ratePerKmOutsideKad||0
  };
}
function financeFromTariffRule(base, rule){
  const rateHour=(+rule.ratePerHour>0)?+rule.ratePerHour:(+base.defaultRatePerHourWork||0);
  const rateKm=(+rule.ratePerKm>0)?+rule.ratePerKm:(+base.defaultRatePerKmCash||0);
  return Object.assign({}, base, {
    minWorkHours:rule.minWorkHours,
    podachaHours:rule.podachaHours,
    podachaEmptyKmLimit:rule.podachaEmptyKmLimit,
    cityKmThreshold:rule.cityKmThreshold,
    defaultRatePerHourWork:rateHour,
    defaultRatePerKmCash:rateKm,
    ratePerKmOutsideKad:rule.ratePerKmKad>0?rule.ratePerKmKad:base.ratePerKmOutsideKad,
    payloadFromTons:rule.payloadFromTons>0?rule.payloadFromTons:base.payloadFromTons,
    payloadToTons:rule.payloadToTons>0?rule.payloadToTons:base.payloadToTons
  });
}
function tariffRuleHumanLabel(rule, dims){
  let title=typeof tariffRuleDisplayTitle==='function'?tariffRuleDisplayTitle(rule):'';
  if(dims&&(dims.payloadTons>0||dims.lengthM>0)){
    title+=` · заявка ${dims.payloadTons||'?'} т`;
    if(dims.lengthM>0) title+=`, ${dims.lengthM} м`;
  }
  return title;
}
function findTariffRuleForOrder(o, fin){
  const base=normalizeFinance(fin||{});
  const dims=orderTariffDimensions(o);
  let matching=(base.tariffRules||[]).filter(r=>tariffRuleMatchesDims(r, dims));
  if(!matching.length){
    return {finance:base, missingRate:true, label:'Нет правила тарифа под заявку', ruleId:null};
  }
  matching.sort((a,b)=>tariffRuleSpecificity(a)-tariffRuleSpecificity(b));
  const pick=matching[0];
  const finMerged=financeFromTariffRule(base, pick);
  if(!(+finMerged.defaultRatePerHourWork>0)){
    return {finance:base, missingRate:true, label:tariffRuleDisplayTitle(pick), ruleId:pick.id};
  }
  return {finance:finMerged, missingRate:false, label:tariffRuleHumanLabel(pick, dims), ruleId:pick.id};
}
function financeForOrderType(o, fin){
  const m=findTariffRuleForOrder(o, fin);
  return m&&m.finance?m.finance:normalizeFinance(fin||{});
}
function tariffTypeSeparate(bodyTypeId, payloadTons){
  const id=String(bodyTypeId||'').trim();
  if(/^(shalanda|tral|lowbed|lowbed_platform|manipulator|crane_truck|oversize)$/.test(id)) return true;
  return (+payloadTons||0)>5;
}
function cabinetTariffTypes(companyId){
  const map=new Map();
  (state.vehicles||[]).forEach(v=>{
    if(!v||v.companyId!==companyId) return;
    const id=String(v.bodyTypeId||'').trim();
    if(!id) return;
    const g=mapVtypeToBodyType(id);
    if(!map.has(g)) map.set(g, (typeof bodyTypeInputLabel==='function'&&bodyTypeInputLabel(id))||id);
  });
  return [...map.entries()].map(([id,label])=>({id, label}));
}
const state={
  step:"idle", orderStep:"idle", messages:[], shift:null,
  shifts:saved.shifts||[], orders:Array.isArray(saved.orders)?saved.orders:[], seq:saved.seq||0,
  vehicles:saved.vehicles&&saved.vehicles.length?saved.vehicles:DEFAULT_VEHICLES.map(v=>({...v})),
  drivers:saved.drivers&&saved.drivers.length?saved.drivers:DEFAULT_DRIVERS.map(d=>({...d})),
  customers:Array.isArray(saved.customers)?saved.customers:[],
  companies:Array.isArray(saved.companies)?saved.companies:[],
  finance:Object.assign({}, DEFAULT_FINANCE, saved.finance||{}),
  admins:Array.isArray(saved.admins)?saved.admins:[],
  adminLogins:Array.isArray(saved.adminLogins)?saved.adminLogins:[],
  adminPresence:Array.isArray(saved.adminPresence)?saved.adminPresence:[],
  spaces:Array.isArray(saved.spaces)?saved.spaces:[],
  settings:Object.assign({fnsApiKey:'',dadataToken:'',yandexMapsApiKey:''}, saved.settings||{}),
  dataEpoch:Number(saved.dataEpoch)||0,
  deletedOrderIds:Array.isArray(saved.deletedOrderIds)?saved.deletedOrderIds.slice():[],
  driverInvites:Array.isArray(saved.driverInvites)?saved.driverInvites:[],
  light:{}, draft:{}, error:"", adminFilter:"all", adminOwnerFilter:"all", detailId:null,
  adminExpandedGroups: (saved.adminExpandedGroups && typeof saved.adminExpandedGroups==='object')?saved.adminExpandedGroups:{},
  billing:(saved.billing && typeof saved.billing==='object')?saved.billing:{spaces:{}},
  epdBySpace:(saved.epdBySpace && typeof saved.epdBySpace==='object')?saved.epdBySpace:{},
  invoices:Array.isArray(saved.invoices)?saved.invoices:[],
  docTemplates:(saved.docTemplates && typeof saved.docTemplates==='object')?saved.docTemplates:{spaces:{}},
  customerPortalLeads:Array.isArray(saved.customerPortalLeads)?saved.customerPortalLeads:[],
  contracts:Array.isArray(saved.contracts)?saved.contracts:[],
  contractsCounter:(saved.contractsCounter&&typeof saved.contractsCounter==='object')?saved.contractsCounter:{year:new Date().getFullYear(), mainSeq:0, tripSeq:{}}
};
/** Список заказов (новые сверху). На /a/ admin.js до app.js — loginAdmin/renderAdmin. */
function allOrders(){ return (state.orders||[]).slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)); }
let pbRecordId=null;
let persistTimer=null;
let autoSyncTimer=null;
let autoSyncBusy=false;
let syncPushInFlight=null;
let syncPushQueued=false;
let pullBackoffUntil=0;
let pullFailCount=0;
let syncStatus='local'; // local | syncing | ok | error (ошибка отправки на сервер)
let syncLastErrorMessage='';
let syncOwnerSubscriptionWarning='';
let syncPullDegraded=false; // фоновый pull не удался — не пугаем водителя, если push ok
let syncPushDegraded=false; // push не удался, но сервер недавно отвечал — не красим баннер
let syncLastServerOkAt=0;
let syncPushRetryTimer=null;
const SYNC_SERVER_OK_GRACE_MS=120000;
function touchSyncServerOk(){
  syncLastServerOkAt=Date.now();
  syncPushDegraded=false;
}
function syncServerRecentlyOk(){
  return syncLastServerOkAt>0 && (Date.now()-syncLastServerOkAt)<SYNC_SERVER_OK_GRACE_MS;
}
function scheduleSyncPushRetry(){
  if(syncPushRetryTimer) return;
  syncPushRetryTimer=setTimeout(()=>{
    syncPushRetryTimer=null;
    if(navigator.onLine===false) return;
    const run=armadaCustomerMustNotPatchState()
      ?flushCustomerPortalSyncQueue()
      :pushServerStateQueued();
    run
      .then(()=>applySyncPushSuccess())
      .catch(err=>applySyncPushFailure(err, 'sync push retry'));
  }, 8000);
}
function applySyncPushSuccess(){
  touchSyncServerOk();
  syncStatus='ok';
  syncLastErrorMessage='';
  syncPullDegraded=false;
  pullFailCount=0;
  if(typeof updateDriverNetHint==='function') updateDriverNetHint();
  if(typeof updateSyncHint==='function') updateSyncHint();
}
function armadaGetSyncStatus(){ return syncStatus; }
function armadaClearSyncPushRetry(){
  if(syncPushRetryTimer){ clearTimeout(syncPushRetryTimer); syncPushRetryTimer=null; }
}
function applySyncPushFailure(err, ctx){
  console.warn(ctx||'sync push', err);
  syncLastErrorMessage=err&&err.message?String(err.message):'';
  syncOwnerSubscriptionWarning='';
  syncPushDegraded=true;
  if(navigator.onLine===false){
    syncStatus='local';
  } else if(syncServerRecentlyOk()){
    syncStatus='ok';
  } else {
    syncStatus='error';
  }
  scheduleSyncPushRetry();
  if(typeof updateDriverNetHint==='function') updateDriverNetHint();
  if(typeof updateSyncHint==='function') updateSyncHint();
}
let currentAdmin=null; // {id,name,isSuper,spaceId} — только в этой вкладке
let presenceTimer=null;
let catalogTab='companies'; // companies | drivers | vehicles | finance
let catalogFinanceCompanyId=null; // какая «наша фирма» правится во вкладке Тариф
let catalogDriverCompanyId=null; // какая фirmа во вкладке Водители / Авто
let catalogActiveCompanyId=null; // компания, открытая в карточке «Компании»
/** Компании с парком (наша / перевозчик) в текущем кабинете. */
function catalogSpaceIds(){
  return new Set((state.spaces||[]).map(s=>s&&s.id).filter(Boolean));
}
/** Компании для селекта «Компания» в справочнике (только companies[], не spaces). */
function catalogCompaniesForSelect(){
  const inSpace=(c)=>typeof companyInMySpace==='function'?companyInMySpace(c):true;
  const spaceIds=catalogSpaceIds();
  return (state.companies||[]).filter(c=>{
    if(!c||!c.id||spaceIds.has(c.id)) return false;
    if(!inSpace(c)) return false;
    return companyHasRole(c,'own')||companyHasRole(c,'carrier');
  });
}
function catalogFleetCompanies(){
  return catalogCompaniesForSelect();
}
/** Выбранная компания для фильтра вкладок (null = все компании в кабинете). */
function catalogScopeCompanyId(){
  return catalogDriverCompanyId||null;
}
function driverInCatalogScope(d, scopeCompanyId, viewSpaceId){
  if(!d) return false;
  if(typeof companyInMySpace==='function'){
    const co=d.companyId?findCompanyById(d.companyId):null;
    if(co && !companyInMySpace(co)) return false;
    if(!co && d.spaceId && viewSpaceId && d.spaceId!==viewSpaceId) return false;
  }
  if(scopeCompanyId) return d.companyId===scopeCompanyId;
  if(viewSpaceId){
    if(d.spaceId===viewSpaceId) return true;
    const co=d.companyId?findCompanyById(d.companyId):null;
    return !!(co&&co.spaceId===viewSpaceId);
  }
  const co=d.companyId?findCompanyById(d.companyId):null;
  return co?typeof companyInMySpace==='function'?companyInMySpace(co):true:false;
}
function vehicleInCatalogScope(v, scopeCompanyId, viewSpaceId){
  if(!v) return false;
  if(typeof companyInMySpace==='function'){
    const co=v.companyId?findCompanyById(v.companyId):null;
    if(co && !companyInMySpace(co)) return false;
    if(!co && v.spaceId && viewSpaceId && v.spaceId!==viewSpaceId) return false;
  }
  if(scopeCompanyId) return v.companyId===scopeCompanyId;
  if(viewSpaceId){
    if(v.spaceId===viewSpaceId) return true;
    const co=v.companyId?findCompanyById(v.companyId):null;
    return !!(co&&co.spaceId===viewSpaceId);
  }
  const co=v.companyId?findCompanyById(v.companyId):null;
  return co?typeof companyInMySpace==='function'?companyInMySpace(co):true:false;
}
/** Чей парк показывать во вкладках и в карточке компании. */
function catalogFleetCompany(){
  const inSpace=(c)=>typeof companyInMySpace==='function'?companyInMySpace(c):true;
  const pickFleetCo=(id)=>{
    if(!id) return null;
    const hit=findCompanyById(id);
    if(!hit||!inSpace(hit)) return null;
    if(!companyHasRole(hit,'own')&&!companyHasRole(hit,'carrier')) return null;
    if(catalogSpaceIds().has(hit.id)) return null;
    return hit;
  };
  if(catalogDriverCompanyId) return pickFleetCo(catalogDriverCompanyId);
  if(catalogActiveCompanyId) return pickFleetCo(catalogActiveCompanyId);
  const my=typeof currentOwnCompany==='function'?currentOwnCompany():null;
  if(my && inSpace(my) && !catalogSpaceIds().has(my.id)) return my;
  const list=catalogFleetCompanies();
  return list[0]||null;
}
function adminDeviceId(){
  let id=localStorage.getItem(DEVICE_KEY);
  if(!id){ id=uuid(); localStorage.setItem(DEVICE_KEY, id); }
  return id;
}
if(!(state.finance.markupPercent>=0)) state.finance.markupPercent=15;
if(state.finance.markupPercent>80) state.finance.markupPercent=80;
if(!(state.finance.cityKmThreshold>0)) state.finance.cityKmThreshold=100;
if(!(state.finance.minWorkHours>=0)) state.finance.minWorkHours=4;
if(!(state.finance.podachaHours>=0)) state.finance.podachaHours=1;
if(!(state.finance.podachaEmptyKmLimit>0)) state.finance.podachaEmptyKmLimit=20;
if(!(state.finance.defaultRatePerHourWork>=0)) state.finance.defaultRatePerHourWork=0;
if(!(state.finance.defaultRatePerKmCash>0)) state.finance.defaultRatePerKmCash=80;
state.finance=normalizeFinance(state.finance);
// Миграция только если в localStorage вообще не было массива orders
if(!Array.isArray(saved.orders) && state.shifts.length){
  state.orders=state.shifts.flatMap(s=>s.orders||[]);
}
function kindTitle(kind){ return kind==='unloading'?'Выгрузка':'Загрузка'; }
function normalizePoint(p, fallbackKind){
  if(typeof p==='string'){
    const address=String(p||'').trim();
    return address?{id:uuid(),address,kind:fallbackKind||'loading'}:null;
  }
  if(!p||typeof p!=='object') return null;
  const address=String(p.address||'').trim();
  if(!address) return null;
  const kind=p.kind==='unloading'?'unloading':'loading';
  return {id:p.id||uuid(),address,kind};
}
function defaultRoutePoints(load, unload){
  return [
    {id:uuid(),address:String(load||'').trim()||'Адрес загрузки',kind:'loading'},
    {id:uuid(),address:String(unload||'').trim()||'Адрес выгрузки',kind:'unloading'}
  ];
}
function ensureRoutePoints(o){
  let raw=Array.isArray(o.routePoints)?o.routePoints:[];
  let pts=[];
  if(raw.length && typeof raw[0]==='string'){
    pts=raw.map((addr,i)=>normalizePoint(addr, i===raw.length-1?'unloading':'loading')).filter(Boolean);
  } else {
    pts=raw.map(p=>normalizePoint(p)).filter(Boolean);
  }
  if(pts.length<2) pts=defaultRoutePoints(o.loadingAddress, o.unloadingAddress);
  o.routePoints=pts;
  o.loadingAddress=(pts.find(p=>p.kind==='loading')||pts[0]).address;
  o.unloadingAddress=( [...pts].reverse().find(p=>p.kind==='unloading')||pts[pts.length-1]).address;
  return pts;
}
function routeText(o){
  return ensureRoutePoints(o).map(p=>`${kindTitle(p.kind)}: ${p.address}`).join(' → ');
}
const $ = id => document.getElementById(id);
function show(id){
  if(id==='driver'||id==='admin'||id==='admin-detail'||id==='admin-create'||id==='admin-claim'||id==='admin-catalogs-screen'||id==='admin-cabinet-settings-screen'||id==='admin-activity-screen'||id==='admin-connect-leads-screen'||id==='admin-social-screen'||id==='admin-billing-screen'||id==='admin-plans-screen'||id==='admin-runs-screen'||id==='admin-docs-screen'||id==='admin-links-screen'||id==='admin-vehicle-card'||id==='admin-driver-card'||id==='customer-portal'){
    if(typeof clearEntrySkin==='function') clearEntrySkin();
  }
  document.querySelectorAll('.phone > .screen').forEach(s=>s.classList.remove('show'));
  $(id).classList.add('show');
  if(id==='admin'){
    try{
      const fn=typeof syncAdminNav==='function'?syncAdminNav:(typeof window!=='undefined'?window.__armadaSyncAdminNav:null);
      if(fn) fn();
    }catch(_){}
  }
  const wide = id==='admin'||id==='admin-detail'||id==='admin-create'||id==='admin-claim'||id==='admin-catalogs-screen'||id==='admin-cabinet-settings-screen'||id==='admin-activity-screen'||id==='admin-connect-leads-screen'||id==='admin-social-screen'||id==='admin-billing-screen'||id==='admin-plans-screen'||id==='admin-runs-screen'||id==='admin-docs-screen'||id==='admin-links-screen'||id==='admin-vehicle-card'||id==='admin-driver-card'||id==='customer-portal';
  $('shell').classList.toggle('wide', wide);
  try{
    if(id==='driver') localStorage.setItem(LAST_ROLE_KEY,'driver');
    else if(id==='customer-login'||id==='customer-portal') localStorage.setItem(LAST_ROLE_KEY,'customer');
    else if(wide) localStorage.setItem(LAST_ROLE_KEY,'admin');
  }catch(_){}
  if(currentAdmin && wide){
    touchAdminPresence(id);
  }
}
const SPLASH_STARTED_MS=Date.now();
const MIN_SPLASH_MS=350;
function showAfterSplash(idOrFn){
  const wait=Math.max(0, MIN_SPLASH_MS-(Date.now()-SPLASH_STARTED_MS));
  const run=()=>{
    if(typeof idOrFn==='function') idOrFn();
    else show(idOrFn);
  };
  if(wait<=0){ run(); return; }
  setTimeout(run, wait);
}
/** Один переход splash → экран (boot-loader + app.js не дублируют). */
function finishSplashOnce(idOrFn){
  if(window.__armadaSplashDone){
    if(typeof idOrFn==='function') idOrFn();
    else if(idOrFn) show(idOrFn);
    return;
  }
  window.__armadaSplashDone=true;
  const run=()=>{
    if(typeof idOrFn==='function') idOrFn();
    else if(idOrFn) show(idOrFn);
  };
  if(document.querySelector('#splash.show')) showAfterSplash(run);
  else run();
}
function isCancelledOrder(o){
  return !!(o && (o.cancelledAt || (o.closedAt && o.cancelReason)));
}
function deletedOrderIdSet(){
  const s=new Set(state.deletedOrderIds||[]);
  RETIRED_ORDER_IDS.forEach(id=>s.add(id));
  return s;
}
function rememberDeletedOrderId(id){
  if(!id) return;
  const list=state.deletedOrderIds||(state.deletedOrderIds=[]);
  if(!list.includes(id)) list.push(id);
}
function unionDeletedOrderIds(extra){
  const list=state.deletedOrderIds||(state.deletedOrderIds=[]);
  RETIRED_ORDER_IDS.forEach(id=>{ if(!list.includes(id)) list.push(id); });
  (extra||[]).forEach(id=>{ if(id && !list.includes(id)) list.push(id); });
  return list;
}
/** Убрать из списка только tombstone (deletedOrderIds + RETIRED), не отменённые по cancelledAt. */
function stripTombstonedOrders(orders){
  const dead=deletedOrderIdSet();
  return (orders||[]).filter(o=>o && !dead.has(o.id));
}
function stripCancelledFromOrders(orders){
  return stripTombstonedOrders(orders);
}
/** Вычистить tombstone-дубли из orders и смен (отменённые по статусу остаются). */
function purgeDeadOrdersEverywhere(){
  unionDeletedOrderIds([]);
  const before=(state.orders||[]).length;
  state.orders=stripCancelledFromOrders(state.orders);
  (state.shifts||[]).forEach(s=>{
    if(Array.isArray(s.orders)) s.orders=stripCancelledFromOrders(s.orders);
  });
  return before!==(state.orders||[]).length;
}
function maxLiveOrderSequentialNumber(){
  let max=0;
  (state.orders||[]).forEach(o=>{
    if(!o||o.sequentialNumber==null) return;
    const n=Number(o.sequentialNumber);
    if(n>max) max=n;
  });
  return max;
}
/** Не перенумеровывает заказы: state.seq = max(счётчик, max № в списке). */
function syncSequentialCounter(){
  purgeDeadOrdersEverywhere();
  let changed=false;
  const floor=maxLiveOrderSequentialNumber();
  const seq=Number(state.seq)||0;
  const next=Math.max(seq, floor);
  if(next!==seq){ state.seq=next; changed=true; }
  const byId=new Map((state.orders||[]).map(o=>[o.id,o]));
  (state.shifts||[]).forEach(s=>{
    if(!Array.isArray(s.orders)) return;
    s.orders.forEach((o,idx)=>{
      const live=byId.get(o.id);
      if(live) s.orders[idx]=live;
    });
  });
  return changed;
}
function nextSequentialNumber(){
  syncSequentialCounter();
  state.seq=(Number(state.seq)||0)+1;
  return state.seq;
}
function normalizeCustomerPortalLead(raw){
  if(!raw||typeof raw!=='object') return null;
  const kindRaw=String(raw.kind||'portal').trim().toLowerCase();
  const kind=kindRaw==='transport'?'transport':kindRaw==='pilot'?'pilot':'portal';
  const company=String(raw.company||raw.companyName||'').trim();
  const phone=typeof formatPhone==='function'?formatPhone(raw.phone||''):String(raw.phone||'').trim();
  const contactName=String(raw.contactName||raw.name||'').trim();
  if(kind==='transport'){
    if(!phone) return null;
    if(!company && !contactName) return null;
  }else if(kind==='pilot'){
    if(!phone) return null;
    if(!company && !contactName) return null;
  }else if(!company||!phone) return null;
  const inn=String(raw.inn||'').replace(/\D/g,'');
  const vehicleTypeId=normalizeArmadaSxVtype(raw.vehicleTypeId||raw.vtype||'');
  const pilotRole=String(raw.pilotRole||raw.role||'').trim().toLowerCase()||null;
  const city=String(raw.city||'').trim()||null;
  const fleetSize=String(raw.fleetSize||raw.vehicles||raw.fleet||'').trim()||null;
  const workNeeds=String(raw.workNeeds||raw.work_needs||'').trim()||null;
  const pilotProject=raw.pilotProject===true||raw.pilot_project===true||String(raw.pilotProject||'').toLowerCase()==='true';
  return {
    id:raw.id||uuid(),
    kind,
    company:company||contactName||'—',
    inn:inn||null,
    phone,
    contactName:contactName||null,
    workNeeds,
    pilotProject,
    comment:String(raw.comment||'').trim()||null,
    carrierHint:String(raw.carrierHint||raw.carrier||'').trim()||null,
    pilotRole,
    city,
    fleetSize,
    vehicleTypeId:vehicleTypeId||null,
    cargoWeightKg:numOrNull(raw.cargoWeightKg),
    cargoPlaces:numOrNull(raw.cargoPlaces),
    cargoVolumeM3:numOrNull(raw.cargoVolumeM3),
    reqLengthM:numOrNull(raw.reqLengthM||raw.cargoLengthM),
    reqWidthM:numOrNull(raw.reqWidthM||raw.cargoWidthM),
    reqHeightM:numOrNull(raw.reqHeightM||raw.cargoHeightM),
    loadAddress:String(raw.loadAddress||raw.address||'').trim()||null,
    unloadAddress:String(raw.unloadAddress||'').trim()||null,
    vehicleAt:String(raw.vehicleAt||'').trim()||null,
    source:String(raw.source||'').trim()||null,
    orderId:raw.orderId||null,
    customerId:raw.customerId||null,
    spaceId:raw.spaceId||null,
    logistCompanyId:raw.logistCompanyId||null,
    logistCompanyName:raw.logistCompanyName||null,
    status:raw.status==='done'?'done':'pending',
    createdAt:raw.createdAt||new Date().toISOString(),
    doneAt:raw.doneAt||null
  };
}
function migrateCustomerPortalLeads(){
  state.customerPortalLeads=(state.customerPortalLeads||[]).map(normalizeCustomerPortalLead).filter(Boolean);
  migrateTransportLeadsInboxOnly();
}
/** Заявка transport → заказ во «Входящие»; pilot/portal — вкладка «Заявки на подключение»; сбой без orderId — Активность. */
function migrateTransportLeadsInboxOnly(){
  let changed=false;
  (state.customerPortalLeads||[]).forEach(l=>{
    if(l.kind!=='transport'||l.status!=='pending'||!l.orderId) return;
    l.status='done';
    l.doneAt=l.doneAt||new Date().toISOString();
    changed=true;
  });
  if(changed) bumpDataEpoch('transport-lead-inbox');
  return changed;
}
/** Ссылки TG/VK для супер-админа (автопост TG/VK — позже на armada-api). */
function migrateMarketingSocial(){
  const ms=state.marketingSocial;
  if(!ms||typeof ms!=='object'){
    state.marketingSocial={ telegramChannelUrl:'', vkGroupUrl:'' };
    return;
  }
  ms.telegramChannelUrl=String(ms.telegramChannelUrl||'').trim();
  ms.vkGroupUrl=String(ms.vkGroupUrl||'').trim();
  state.marketingSocial=ms;
}
/** Канал MAX (бот + chat_id) — хранится в облаке, посты через armada-api /marketing/max/* */
function isPlausibleMaxBotToken(t){
  const s=String(t||'').trim();
  if(!s||s.length<16) return false;
  if(/[^\x21-\x7E]/.test(s)) return false;
  if(/max\.ru|^https?:/i.test(s)) return false;
  if(/•/.test(s)||/\u2022/.test(s)) return false;
  return true;
}
function migrateMarketingMax(){
  const mm=state.marketingMax;
  if(!mm||typeof mm!=='object'){
    state.marketingMax={ bot:{ token:'', chatId:'', enabled:false }, queue:[] };
    return;
  }
  if(!mm.bot||typeof mm.bot!=='object') mm.bot={ token:'', chatId:'', enabled:false };
  mm.bot.token=String(mm.bot.token||'');
  if(mm.bot.token&&!isPlausibleMaxBotToken(mm.bot.token)) mm.bot.token='';
  mm.bot.chatId=String(mm.bot.chatId||'');
  mm.bot.enabled=!!mm.bot.enabled;
  if(!Array.isArray(mm.queue)) mm.queue=[];
  mm.queue=mm.queue.filter(Boolean).map(item=>{
    if(!item||typeof item!=='object') return null;
    return {
      id:String(item.id||uuid()),
      text:String(item.text||'').slice(0,4000),
      status:['draft','scheduled','published','failed','cancelled'].includes(item.status)?item.status:'draft',
      scheduledAt:item.scheduledAt?String(item.scheduledAt):'',
      publishedAt:item.publishedAt?String(item.publishedAt):'',
      maxMessageId:item.maxMessageId!=null?String(item.maxMessageId):'',
      error:String(item.error||''),
      title:String(item.title||'').slice(0,120),
      createdAt:item.createdAt?String(item.createdAt):(new Date().toISOString()),
      updatedAt:item.updatedAt?String(item.updatedAt):''
    };
  }).filter(Boolean);
  state.marketingMax=mm;
}
async function postMarketingMaxApi(action, body){
  if(!API_BASE) throw new Error('API недоступен');
  await ensureArmadaApiToken({});
  const res=await fetchWithTimeout(`${API_BASE}/marketing/max/${action}`, {
    method:'POST',
    headers:armadaApiJsonHeaders(),
    body:JSON.stringify(body||{})
  }, 20000);
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error||data.message||('HTTP '+res.status));
  return data;
}
async function marketingMaxTestPost(){
  return postMarketingMaxApi('test', {});
}
async function marketingMaxDiscoverChat(){
  return postMarketingMaxApi('discover-chat', {});
}
async function marketingMaxPublishScheduled(){
  return postMarketingMaxApi('tick', {});
}
async function marketingMaxPublishPost(postId, text){
  return postMarketingMaxApi('publish', { postId:String(postId||''), text:String(text||'') });
}
function companyOwnRole(c){
  return !!(c&&Array.isArray(c.roles)&&c.roles.includes('own'));
}
function companyHasRole(c, role){
  return !!(c&&Array.isArray(c.roles)&&c.roles.includes(role));
}
function contactPhone(contact){
  if(!contact) return '';
  if(typeof contact==='string') return formatPhone(contact);
  if(contact.phone) return formatPhone(contact.phone);
  const ph=(contact.phones||[])[0];
  if(ph) return formatPhone(ph.number||ph.phone||ph);
  return '';
}
function driverPercent(name, companyId){
  const list=state.drivers||[];
  if(companyId){
    const hit=list.find(d=>samePersonName(d.name,name) && d.companyId===companyId);
    if(hit) return hit.salaryPercent??30;
  }
  return (list.find(d=>samePersonName(d.name,name))||{salaryPercent:30}).salaryPercent;
}
/** Минимальный upsert для order.html (полная версия в app.js на /a). */
function upsertCompany(raw){
  if(!raw) return null;
  const name=String(raw.name||'').trim();
  if(!name) return null;
  const spaceId=raw.spaceId||null;
  const roles=Array.isArray(raw.roles)?raw.roles.slice():[];
  const idx=(state.companies||[]).findIndex(x=>{
    if(raw.id && x.id===raw.id) return true;
    return String(x.name).toLowerCase()===name.toLowerCase() && (x.spaceId||null)===(spaceId||null);
  });
  const base={
    name,
    roles,
    note:String(raw.note||'').trim(),
    contacts:raw.contacts||[],
    phones:raw.phones||[],
    loadingAddresses:raw.loadingAddresses||[],
    unloadingAddresses:raw.unloadingAddresses||[],
    vehicles:raw.vehicles||[],
    drivers:raw.drivers||[],
    spaceId,
    inn:raw.inn||'',
    ogrn:raw.ogrn||'',
    kpp:raw.kpp||'',
    address:raw.address||''
  };
  if(idx>=0){
    const prev=state.companies[idx];
    const merged=Object.assign({}, prev, base, {
      id:prev.id,
      roles:[...new Set([...(prev.roles||[]), ...roles])]
    });
    state.companies[idx]=merged;
    state.companies.sort((a,b)=>String(a.name).localeCompare(String(b.name),'ru'));
    return merged;
  }
  const created=Object.assign({id:raw.id||uuid()}, base);
  state.companies.push(created);
  state.companies.sort((a,b)=>String(a.name).localeCompare(String(b.name),'ru'));
  return created;
}
function findArmadaLogistCompany(){
  if(typeof migrateSpaces==='function') migrateSpaces();
  const companies=state.companies||[];
  let hit=companies.find(c=>companyOwnRole(c)&&String(c.name||'').toLowerCase().includes('армада'));
  if(hit) return hit;
  const sp=(state.spaces||[]).find(s=>String(s.name||'').toLowerCase().includes('армада'));
  if(sp){
    hit=companies.find(c=>companyOwnRole(c)&&c.spaceId===sp.id);
    if(hit) return hit;
  }
  return null;
}
function mergeUniqueAddresses(existing, extra){
  const seen=new Set();
  const out=[];
  [...(existing||[]), ...(Array.isArray(extra)?extra:[extra])].forEach(a=>{
    const s=String(a||'').trim();
    if(!s) return;
    const k=s.toLowerCase();
    if(seen.has(k)) return;
    seen.add(k);
    out.push(s);
  });
  return out;
}
function mapVtypeToBodyType(vtypeId){
  const id=String(vtypeId||'').trim();
  if(!id) return 'board';
  const meta=ATI_BODY_TYPES.find(x=>x.id===id);
  return meta&&meta.mapTo?meta.mapTo:'board';
}
function findArmadaCustomerByPhone(spaceId, phone){
  const ph=typeof formatPhone==='function'?formatPhone(phone||''):String(phone||'').trim();
  if(!ph) return null;
  return (state.companies||[]).find(c=>{
    if(spaceId&&c.spaceId!==spaceId) return false;
    if(!Array.isArray(c.roles)||!c.roles.includes('customer')) return false;
    if(typeof formatPhone==='function'&&formatPhone(c.portalPhone||'')===ph) return true;
    if((c.phones||[]).some(p=>formatPhone(p)===ph)) return true;
    return (c.contacts||[]).some(p=>formatPhone(p.phone||p)===ph);
  })||null;
}
function ensureArmadaCustomerFromLead(lead, armadaCo){
  if(!lead||!armadaCo) return null;
  const spaceId=armadaCo.spaceId||null;
  const phone=lead.phone;
  let co=findArmadaCustomerByPhone(spaceId, phone);
  const loadAddr=lead.loadAddress||'';
  const unloadAddr=lead.unloadAddress||'';
  if(co){
    if(loadAddr) co.loadingAddresses=mergeUniqueAddresses(co.loadingAddresses, loadAddr);
    if(unloadAddr) co.unloadingAddresses=mergeUniqueAddresses(co.unloadingAddresses, unloadAddr);
    if(lead.inn&&!co.inn) co.inn=lead.inn;
    if(!co.spaceId&&spaceId) co.spaceId=spaceId;
    if(!co.portalPhone) co.portalPhone=phone;
    if(lead.contactName){
      const has=(co.contacts||[]).some(p=>String(p.name||'').trim().toLowerCase()===lead.contactName.toLowerCase());
      if(!has){
        co.contacts=(co.contacts||[]).concat([{name:lead.contactName, phone, role:''}]);
      }
    }
    return co;
  }
  co={
    id:uuid(),
    name:lead.company,
    roles:['customer'],
    spaceId,
    inn:lead.inn||'',
    note:lead.source?`С ${lead.source}`:'',
    portalPhone:phone,
    portalEnabled:false,
    portalPin:'',
    loadingAddresses:loadAddr?[loadAddr]:[],
    unloadingAddresses:unloadAddr?[unloadAddr]:[],
    contacts:lead.contactName?[{name:lead.contactName, phone, role:''}]:[],
    phones:[phone],
    vehicles:[],
    drivers:[]
  };
  state.companies=(state.companies||[]).concat([co]);
  state.companies.sort((a,b)=>String(a.name).localeCompare(String(b.name),'ru'));
  if(typeof syncCustomersFromCompanies==='function') syncCustomersFromCompanies();
  return co;
}
function insertPublicTransportOrder(lead, customerCo, armadaCo){
  const spaceId=armadaCo.spaceId||null;
  const spaceAdm=(state.admins||[]).find(a=>a.spaceId===spaceId)||(state.admins||[]).find(a=>a.isSuper)||null;
  const seqNo=nextSequentialNumber();
  const now=new Date().toISOString();
  const load=String(lead.loadAddress||'').trim()||'—';
  const unload=String(lead.unloadAddress||'').trim()||load;
  const vtypes=lead.vehicleTypeId?[lead.vehicleTypeId]:[];
  const order={
    id:uuid(),
    sequentialNumber:seqNo,
    dayNumber:1,
    createdAt:now,
    source:'armada_sx',
    customerSubmitted:true,
    publicLeadId:lead.id,
    ownerAdminId:spaceAdm&&spaceAdm.id||null,
    ownerAdminName:spaceAdm&&spaceAdm.name||'',
    spaceId,
    customer:customerCo.name,
    customerId:customerCo.id,
    customerInn:customerCo.inn||'',
    ownCompanyId:armadaCo.id,
    ownCompanyName:armadaCo.name,
    contactName:lead.contactName||lead.company||'',
    contactPhone:lead.phone||'',
    loadingContactName:lead.contactName||'',
    loadingContactPhone:lead.phone||'',
    cargoDescription:lead.comment||'',
    loadingAddress:load,
    unloadingAddress:unload,
    routePoints:defaultRoutePoints(load, unload),
    vehicleAt:lead.vehicleAt||null,
    vehiclePlate:'—',
    driverName:'Диспетчер',
    driverPercent:0,
    executorType:'logist',
    onExchange:false,
    fulfillment:'logist',
    pricePending:true,
    priceForClient:null,
    reqBodyType:mapVtypeToBodyType(lead.vehicleTypeId),
    vehicleTypeIds:vtypes,
    partnerSpaceId:null,
    transportApp:null
  };
  if(lead.cargoWeightKg>0){
    order.cargoWeightKg=lead.cargoWeightKg;
    order.reqPayloadTons=Math.round(lead.cargoWeightKg/10)/100;
  }
  if(lead.cargoPlaces>0) order.cargoPlaces=lead.cargoPlaces;
  if(lead.cargoVolumeM3>0) order.cargoVolumeM3=lead.cargoVolumeM3;
  if(lead.reqLengthM>0) order.reqLengthM=lead.reqLengthM;
  if(lead.reqWidthM>0) order.reqWidthM=lead.reqWidthM;
  if(lead.reqHeightM>0) order.reqHeightM=lead.reqHeightM;
  applyVehicleTypeDefaultReqs(order, true);
  if(!(order.cargoVolumeM3>0)&&order.reqLengthM>0&&order.reqWidthM>0&&order.reqHeightM>0){
    order.cargoVolumeM3=Math.round(order.reqLengthM*order.reqWidthM*order.reqHeightM*10)/10;
  }
  ensureRoutePoints(order);
  state.orders=state.orders||[];
  state.orders.unshift(order);
  lead.orderId=order.id;
  lead.customerId=customerCo.id;
  lead.spaceId=spaceId;
  lead.logistCompanyId=armadaCo.id;
  lead.logistCompanyName=armadaCo.name;
  return order;
}
function attachArmadaTransportLead(rec){
  if(!rec||rec.kind!=='transport'||rec.orderId) return null;
  const armada=findArmadaLogistCompany();
  if(!armada){
    console.warn('ООО «Армада» не найдена в справочнике — заявка сохранена без заказа');
    return null;
  }
  const customer=ensureArmadaCustomerFromLead(rec, armada);
  if(!customer) return null;
  return insertPublicTransportOrder(rec, customer, armada);
}
function revertArmadaLocalSnapshot(json){
  if(!json) return;
  try{
    const p=JSON.parse(json);
    if(typeof applyPayload==='function') applyPayload(p, {remoteSeq:false});
    if(typeof persistLocalOnly==='function') persistLocalOnly();
  }catch(err){ console.warn('revert local snapshot', err); }
}
async function appendCustomerPortalLead(raw, opts){
  opts=opts||{};
  const rollbackOnFail=!!opts.rollbackOnPersistFail;
  const rollbackJson=rollbackOnFail?JSON.stringify(snapshot()):null;
  const revert=()=>{ if(rollbackJson) revertArmadaLocalSnapshot(rollbackJson); };
  migrateCustomerPortalLeads();
  const rec=normalizeCustomerPortalLead(raw);
  if(!rec) return {ok:false, error:'Заполните компанию и телефон'};
  const dup=(state.customerPortalLeads||[]).find(l=>
    l.status==='pending' && l.phone===rec.phone && l.company.toLowerCase()===rec.company.toLowerCase()
  );
  if(dup) return {ok:true, id:dup.id, duplicate:true, orderId:dup.orderId||null};
  state.customerPortalLeads.unshift(rec);
  let order=null;
  if(rec.kind==='transport'){
    order=attachArmadaTransportLead(rec);
    if(order){
      bumpDataEpoch('armada-sx-order');
      rec.status='done';
      rec.doneAt=new Date().toISOString();
    }
  }
  bumpDataEpoch('customer-portal-lead');
  persistLocalOnly();
  if(rec.kind==='transport'&&!rec.orderId){
    revert();
    return {ok:false, error:'Не удалось создать заказ — проверьте связь с сервером и справочник ООО «Армада»'};
  }
  try{
    if(typeof persistCustomerPortalOrderImmediate==='function'){
      const push=await persistCustomerPortalOrderImmediate(rec.orderId||null);
      if(push&&push.ok===false){
        revert();
        throw new Error(push.offline?'Нет связи с сервером — заявка не сохранена':'Не удалось сохранить на сервер');
      }
    }else{
      await persist();
    }
    return {
      ok:true,
      id:rec.id,
      orderId:rec.orderId||null,
      orderNumber:order&&order.sequentialNumber||null,
      customerId:rec.customerId||null
    };
  }catch(err){
    revert();
    console.warn('customer portal lead persist', err);
    const msg=(err&&err.message)||'';
    const offline=/Нет связи|offline|Failed to fetch|NetworkError|ERR_/i.test(msg)||(typeof navigator!=='undefined'&&navigator.onLine===false);
    const userMsg=offline?'Нет связи с сервером — заявка не сохранена':msg;
    const error=(typeof armadaUserFacingError==='function'?armadaUserFacingError(userMsg):userMsg)||'Не удалось сохранить на сервер';
    return {
      ok:false,
      error,
      id:rec.id,
      orderId:null
    };
  }
}
function markCustomerPortalLeadDone(leadId){
  migrateCustomerPortalLeads();
  const lead=(state.customerPortalLeads||[]).find(l=>l.id===leadId);
  if(!lead) return false;
  lead.status='done';
  lead.doneAt=new Date().toISOString();
  bumpDataEpoch('customer-lead-done');
  persist();
  return true;
}
function pendingCustomerPortalLeads(){
  migrateCustomerPortalLeads();
  return (state.customerPortalLeads||[]).filter(l=>l.status==='pending');
}
function pendingTransportOrders(){
  return pendingCustomerPortalLeads().filter(l=>l.kind==='transport');
}
function pendingPortalAccessLeads(){
  return pendingCustomerPortalLeads().filter(l=>l.kind==='portal');
}
function pendingPilotLeads(){
  return pendingCustomerPortalLeads().filter(l=>l.kind==='pilot');
}
function pilotRoleNorm(role){
  const r=String(role||'').trim().toLowerCase();
  if(r==='carrier'||r==='перевозчик') return 'carrier';
  if(r==='logist'||r==='логист') return 'logist';
  return r||'';
}
/** Заявки на подключение: перевозчик (pilot). */
function pendingCarrierConnectLeads(){
  return pendingCustomerPortalLeads().filter(l=>l.kind==='pilot'&&l.pilotProject!==true&&pilotRoleNorm(l.pilotRole)==='carrier');
}
/** Заявки на подключение: логист / кабинет (pilot). */
function pendingLogistConnectLeads(){
  return pendingCustomerPortalLeads().filter(l=>l.kind==='pilot'&&l.pilotProject!==true&&pilotRoleNorm(l.pilotRole)==='logist');
}
function pendingPilotProjectLeads(){
  return pendingCustomerPortalLeads().filter(l=>l.kind==='pilot'&&l.pilotProject===true);
}
function pendingConnectLeadsCount(){
  return pendingPortalAccessLeads().length+pendingCarrierConnectLeads().length+pendingLogistConnectLeads().length+pendingPilotProjectLeads().length;
}
const ARMADA_AUTO_EPOCH_MAX_PER_MIN=3;
const ARMADA_AUTO_EPOCH_REPEAT_MS=8000;
let armadaAutoEpochLog=[];
let armadaAutoEpochHalted=false;
function armadaAutoEpochResetGuard(){
  armadaAutoEpochLog=[];
  armadaAutoEpochHalted=false;
}
/** Лимит автоматических dataEpoch (reconcile, документы) — защита от пинг-понга. */
function armadaAutoEpochAllowed(reason, orderId){
  if(armadaAutoEpochHalted) return false;
  const tag=String(reason||'auto');
  const oid=orderId!=null?String(orderId):'';
  const now=Date.now();
  while(armadaAutoEpochLog.length&&now-armadaAutoEpochLog[0].at>60000) armadaAutoEpochLog.shift();
  const last=armadaAutoEpochLog[armadaAutoEpochLog.length-1];
  if(last&&last.tag===tag&&last.orderId===oid&&now-last.at<ARMADA_AUTO_EPOCH_REPEAT_MS){
    armadaAutoEpochHalted=true;
    console.warn('автозапись остановлена: цикл', tag);
    return false;
  }
  if(armadaAutoEpochLog.length>=ARMADA_AUTO_EPOCH_MAX_PER_MIN){
    armadaAutoEpochHalted=true;
    console.warn('автозапись остановлена: цикл', tag);
    return false;
  }
  return true;
}
function bumpDataEpochAuto(reason, orderId){
  if(!armadaAutoEpochAllowed(reason, orderId)) return false;
  bumpDataEpoch(reason);
  armadaAutoEpochLog.push({at:Date.now(), tag:String(reason||'auto'), orderId:orderId!=null?String(orderId):''});
  return true;
}
function bumpDataEpoch(reason){
  state.dataEpoch=(Number(state.dataEpoch)||0)+1;
  console.info('dataEpoch →', state.dataEpoch, reason||'');
}
/** S3-2.6: журнал ops для супер-админа (ЭТрН, API). */
function logOpsEvent(kind, detail, meta){
  if(!state.opsLog) state.opsLog=[];
  state.opsLog.unshift({
    id:uuid(),
    at:new Date().toISOString(),
    kind:String(kind||'info'),
    detail:String(detail||''),
    meta:meta&&typeof meta==='object'?meta:null
  });
  if(state.opsLog.length>60) state.opsLog.length=60;
}
function normalizeEpdSpaceRecord(rec, spaceId){
  const sp=spaceId?findSpaceById(spaceId):null;
  const co=spaceId&&typeof ownCompanyForSpaceId==='function'?ownCompanyForSpaceId(spaceId):null;
  const boxId=String(rec&&rec.boxId||'').trim();
  let status=rec&&rec.status;
  if(!['pending','connected','error'].includes(status)) status=boxId?'connected':'pending';
  return {
    operator:String(rec&&rec.operator||'kontur').trim()||'kontur',
    sandbox:rec&&rec.sandbox!=null?!!rec.sandbox:true,
    orgInn:normalizeLoginInn(rec&&rec.orgInn||(co&&co.inn)||(sp&&sp.inn)||''),
    boxId,
    status,
    connectedAt:rec&&rec.connectedAt||null,
    lastError:rec&&rec.lastError?String(rec.lastError):''
  };
}
function epdSpaceForSpaceId(spaceId){
  if(!spaceId) return normalizeEpdSpaceRecord(null, null);
  if(!state.epdBySpace||typeof state.epdBySpace!=='object') state.epdBySpace={};
  return normalizeEpdSpaceRecord(state.epdBySpace[spaceId], spaceId);
}
function setEpdSpaceRecord(spaceId, patch){
  if(!spaceId) return null;
  if(!state.epdBySpace||typeof state.epdBySpace!=='object') state.epdBySpace={};
  const prev=state.epdBySpace[spaceId]||{};
  const next=normalizeEpdSpaceRecord(Object.assign({}, prev, patch||{}), spaceId);
  if(patch&&patch.boxId!==undefined && next.boxId && !next.connectedAt) next.connectedAt=new Date().toISOString();
  state.epdBySpace[spaceId]=next;
  if(typeof bumpDataEpoch==='function') bumpDataEpoch('epd-space');
  return next;
}
function epdBySpaceSnapshotSlice(){
  const out={};
  Object.keys(state.epdBySpace||{}).forEach(sid=>{
    out[sid]=normalizeEpdSpaceRecord(state.epdBySpace[sid], sid);
  });
  return out;
}
function applyEpdBySpacePayload(raw){
  if(!raw||typeof raw!=='object') return;
  if(!state.epdBySpace||typeof state.epdBySpace!=='object') state.epdBySpace={};
  Object.keys(raw).forEach(sid=>{
    state.epdBySpace[sid]=normalizeEpdSpaceRecord(raw[sid], sid);
  });
}
function epdSpaceStatusLabel(st){
  if(st==='connected') return 'подключено';
  if(st==='error') return 'ошибка';
  return 'ждём boxId';
}
async function fetchEpdSpaceFromApi(spaceId){
  if(!API_BASE||!spaceId) return null;
  try{
    const headers=typeof armadaApiJsonHeaders==='function'?armadaApiJsonHeaders():{Accept:'application/json'};
    const res=await fetch(`${API_BASE}/epd/space/${encodeURIComponent(spaceId)}`, { headers });
    if(!res.ok) return null;
    const data=await res.json().catch(()=>({}));
    return data&&data.epd?normalizeEpdSpaceRecord(data.epd, spaceId):null;
  }catch(_){ return null; }
}
async function saveEpdSpaceToApi(spaceId, patch){
  if(!API_BASE||!spaceId) return null;
  try{
    const headers=typeof armadaApiJsonHeaders==='function'?armadaApiJsonHeaders():{Accept:'application/json','Content-Type':'application/json'};
    if(typeof armadaAdminDocumentsApiActive==='function'&&armadaAdminDocumentsApiActive()){
      const res=await fetchArmadaApi(`/spaces/${encodeURIComponent(spaceId)}/epd-connection`, {
        method:'PATCH', headers, body:JSON.stringify({ epd:patch||{} })
      }, PATCH_TIMEOUT_MS, true);
      if(res.ok) return await res.json().catch(()=>null);
    }
    const res=await fetch(`${API_BASE}/epd/space/${encodeURIComponent(spaceId)}`, {
      method:'PUT', headers, body:JSON.stringify(patch||{})
    });
    if(!res.ok) return null;
    return await res.json().catch(()=>null);
  }catch(_){ return null; }
}
async function syncEpdSpaceFromServer(spaceId){
  const remote=await fetchEpdSpaceFromApi(spaceId);
  if(!remote) return false;
  setEpdSpaceRecord(spaceId, remote);
  if(typeof persist==='function') persist();
  return true;
}
async function syncAllEpdSpacesFromServer(){
  if(!API_BASE) return 0;
  const ids=(state.spaces||[]).map(s=>s&&s.id).filter(Boolean);
  let n=0;
  for(const sid of ids){
    if(await syncEpdSpaceFromServer(sid)) n++;
  }
  return n;
}
function armadaDriverCompanyIdForStorage(){
  try{
    const g=typeof globalThis!=='undefined'?globalThis:(typeof window!=='undefined'?window:null);
    const fromGlobal=g&&g.DRIVER_COMPANY_ID;
    if(fromGlobal) return fromGlobal;
    if(typeof DRIVER_COMPANY_ID!=='undefined'&&DRIVER_COMPANY_ID) return DRIVER_COMPANY_ID;
  }catch(_){}
  return null;
}
function openShiftIdForLocalCompact(){
  if(state.shift&&!state.shift.endedAt) return state.shift.id;
  const name=armadaDriverSessionName();
  if(!name) return null;
  const open=(state.shifts||[]).find(s=>s&&!s.endedAt&&s.driverName&&samePersonName(s.driverName,name));
  return open?open.id:null;
}
/** Снимок для localStorage: в кабинете водителя — урезанный, сервер остаётся полным через snapshot(). */
function snapshotForLocalStorage(){
  const full=snapshot();
  if(!armadaDriverWriteSessionActive()) return full;
  const name=armadaDriverSessionName();
  const companyId=armadaDriverCompanyIdForStorage();
  let o=structuredClone(full);
  o.opsLog=[];
  o.adminPresence={};
  o.customerPortalLeads=[];
  o.invoices=[];
  o.contracts=[];
  o.docTemplates={};
  o.marketingMax={bot:{token:'',chatId:'',enabled:false},queue:[]};
  o.marketingSocial={telegramChannelUrl:'',vkGroupUrl:''};
  o.admins=[];
  o.adminLogins=[];
  if(o.epdBySpace&&typeof o.epdBySpace==='object'){
    const slim={};
    Object.keys(o.epdBySpace).forEach(sid=>{
      const v=o.epdBySpace[sid];
      if(v&&typeof v==='object') slim[sid]={status:v.status,boxId:v.boxId};
    });
    o.epdBySpace=slim;
  }
  const openId=openShiftIdForLocalCompact();
  const shifts=(o.shifts||[]).filter(s=>{
    if(!s) return false;
    if(!name) return true;
    if(s.driverName&&samePersonName(s.driverName,name)) return true;
    if(companyId&&s.ownCompanyId===companyId&&!s.driverName) return true;
    return false;
  });
  shifts.sort((a,b)=>new Date(b.startedAt||0)-new Date(a.startedAt||0));
  const capped=shifts.slice(0,40);
  const shiftKeep=new Set(capped.map(s=>s&&s.id).filter(Boolean));
  if(openId) shiftKeep.add(openId);
  o.shifts=capped.map(s=>{
    const copy={...s};
    const isOpen=openId&&copy.id===openId;
    if(!isOpen){
      delete copy.messages;
      delete copy.draft;
      delete copy.uiStep;
      delete copy.orderStep;
    }else if(Array.isArray(copy.messages)&&copy.messages.length>80){
      copy.messages=copy.messages.slice(-80);
    }
    if(Array.isArray(copy.orders)){
      copy.orders=copy.orders.map(ord=>{
        if(!ord||typeof ord!=='object') return ord;
        const c={...ord};
        delete c.messages;
        delete c.chat;
        return c;
      });
    }
    return copy;
  });
  const orderIds=new Set();
  o.shifts.forEach(s=>{(s.orders||[]).forEach(ord=>{ if(ord&&ord.id) orderIds.add(ord.id); });});
  o.orders=(o.orders||[]).filter(ord=>{
    if(!ord) return false;
    if(orderIds.has(ord.id)) return true;
    if(!name) return false;
    const dn=ord.driverName||ord.assignedDriverName||'';
    if(dn&&samePersonName(dn,name)) return true;
    return false;
  }).slice(0,48).map(ord=>{
    const c={...ord};
    delete c.messages;
    delete c.chat;
    if(!orderIds.has(ord.id)){
      delete c.loading;
      delete c.unloading;
      delete c.routePoints;
    }
    return c;
  });
  if(companyId&&Array.isArray(o.drivers)){
    o.drivers=o.drivers.filter(d=>d&&d.companyId===companyId);
  }
  if(companyId&&Array.isArray(o.vehicles)){
    o.vehicles=o.vehicles.filter(v=>v&&v.companyId===companyId);
  }
  return compactPayloadForLocalStorage(o,{openShiftId:openId, level:3});
}
function persistSnapshotToLocalStorage(){
  return armadaLocalStorageSetJson(KEY, ()=>snapshotForLocalStorage());
}
function snapshot(){
  const orders=stripTombstonedOrders(state.orders);
  const shifts=(state.shifts||[]).map(s=>{
    const copy={...s};
    if(Array.isArray(copy.orders)) copy.orders=stripTombstonedOrders(copy.orders);
    return copy;
  });
  return {
    shifts,
    orders,
    seq:state.seq,
    vehicles:state.vehicles,
    drivers:state.drivers,
    customers:state.customers,
    companies:state.companies,
    finance:state.finance,
    admins:state.admins,
    adminLogins:state.adminLogins,
    adminPresence:state.adminPresence,
    spaces:state.spaces,
    settings:state.settings,
    deletedOrderIds:Array.from(deletedOrderIdSet()),
    deletedDriverKeys:Array.isArray(state.deletedDriverKeys)?state.deletedDriverKeys:[],
    driverInvites:Array.isArray(state.driverInvites)?state.driverInvites:[],
    dataEpoch:Number(state.dataEpoch)||0,
    billing:typeof billingSnapshotSlice==='function'?billingSnapshotSlice():state.billing,
    epdBySpace:typeof epdBySpaceSnapshotSlice==='function'?epdBySpaceSnapshotSlice():(state.epdBySpace||{}),
    invoices:Array.isArray(state.invoices)?state.invoices:[],
    docTemplates:typeof docTemplatesSnapshotSlice==='function'?docTemplatesSnapshotSlice():state.docTemplates,
    customerPortalLeads:Array.isArray(state.customerPortalLeads)?state.customerPortalLeads:[],
    contracts:Array.isArray(state.contracts)?state.contracts.map(c=>Object.assign({},c)):[],
    contractsCounter:state.contractsCounter&&typeof state.contractsCounter==='object'?Object.assign({tripSeq:{}}, state.contractsCounter):{year:new Date().getFullYear(), mainSeq:0, tripSeq:{}},
    opsLog:Array.isArray(state.opsLog)?state.opsLog:[],
    marketingMax:typeof marketingMaxSnapshotSlice==='function'?marketingMaxSnapshotSlice():state.marketingMax,
    marketingSocial:typeof marketingSocialSnapshotSlice==='function'?marketingSocialSnapshotSlice():state.marketingSocial,
    savedAt:new Date().toISOString(),
    appBuild:APP_BUILD
  };
}
function marketingMaxSnapshotSlice(){
  if(typeof migrateMarketingMax==='function') migrateMarketingMax();
  const mm=state.marketingMax||{ bot:{ token:'', chatId:'', enabled:false }, queue:[] };
  return {
    bot:{
      token:String(mm.bot&&mm.bot.token||''),
      chatId:String(mm.bot&&mm.bot.chatId||''),
      enabled:!!(mm.bot&&mm.bot.enabled)
    },
    queue:Array.isArray(mm.queue)?mm.queue.slice():[]
  };
}
function marketingSocialSnapshotSlice(){
  if(typeof migrateMarketingSocial==='function') migrateMarketingSocial();
  const ms=state.marketingSocial||{ telegramChannelUrl:'', vkGroupUrl:'' };
  return {
    telegramChannelUrl:String(ms.telegramChannelUrl||''),
    vkGroupUrl:String(ms.vkGroupUrl||'')
  };
}
function scorePayload(p){
  if(!p||typeof p!=='object') return 0;
  return (p.orders&&p.orders.length||0)*10 + (p.shifts&&p.shifts.length||0)*3
    + (p.companies&&p.companies.length||0) + (p.customers&&p.customers.length||0) + (p.seq||0);
}
function applyPayload(p, opts){
  if(!p||typeof p!=='object') return;
  const keepShifts=opts&&opts.keepShifts;
  const keepOrders=opts&&opts.keepOrders;
  // Сначала tombstone (+ RETIRED), потом фильтр заказов — иначе дубль снова попадает в список
  unionDeletedOrderIds(p.deletedOrderIds||[]);
  state.deletedDriverKeys=Array.isArray(p.deletedDriverKeys)?p.deletedDriverKeys:[];
  state.shifts=Array.isArray(p.shifts)?p.shifts:[];
  (state.shifts||[]).forEach(s=>{ if(Array.isArray(s.orders)) s.orders=stripCancelledFromOrders(s.orders); });
  // Явный массив orders с сервера (в т.ч. []) — закон. Не поднимаем заказы из смен.
  state.orders=Array.isArray(p.orders)?stripCancelledFromOrders(p.orders):[];
  // remoteSeq: сервер задаёт счётчик № базы целиком (после удаления дубля можно сжать нумерацию).
  // Иначе Math.max не даёт seq уменьшиться со старой вкладки.
  if(opts&&opts.remoteSeq) state.seq=Number(p.seq)||0;
  else state.seq=Math.max(Number(p.seq)||0, Number(state.seq)||0);
  state.vehicles=(p.vehicles&&p.vehicles.length)?p.vehicles.map(normalizeFleetVehicle).filter(Boolean):DEFAULT_VEHICLES.map(v=>normalizeFleetVehicle(v)).filter(Boolean);
  state.drivers=(p.drivers&&p.drivers.length)?p.drivers:DEFAULT_DRIVERS.map(d=>({...d}));
  state.customers=Array.isArray(p.customers)?p.customers:[];
  state.companies=Array.isArray(p.companies)?p.companies:[];
  state.finance=Object.assign({}, DEFAULT_FINANCE, p.finance||{});
  state.spaces=Array.isArray(p.spaces)?p.spaces:[];
  if(typeof applyBillingPayload==='function') applyBillingPayload(p.billing);
  else if(p.billing&&typeof p.billing==='object') state.billing=p.billing;
  if(typeof applyEpdBySpacePayload==='function') applyEpdBySpacePayload(p.epdBySpace);
  else if(p.epdBySpace&&typeof p.epdBySpace==='object') state.epdBySpace=p.epdBySpace;
  state.invoices=Array.isArray(p.invoices)?p.invoices:[];
  if(typeof applyDocTemplatesPayload==='function') applyDocTemplatesPayload(p.docTemplates);
  else if(p.docTemplates&&typeof p.docTemplates==='object') state.docTemplates=p.docTemplates;
  state.settings=Object.assign({fnsApiKey:'',dadataToken:'',yandexMapsApiKey:''}, state.settings||{}, p.settings||{});
  state.driverInvites=Array.isArray(p.driverInvites)?p.driverInvites:[];
  state.customerPortalLeads=Array.isArray(p.customerPortalLeads)?p.customerPortalLeads.map(normalizeCustomerPortalLead).filter(Boolean):[];
  state.contracts=Array.isArray(p.contracts)?p.contracts.map(c=>typeof normalizeContract==='function'?normalizeContract(c):c):[];
  state.contractsCounter=(p.contractsCounter&&typeof p.contractsCounter==='object')?p.contractsCounter:{year:new Date().getFullYear(), mainSeq:0, tripSeq:{}};
  state.opsLog=Array.isArray(p.opsLog)?p.opsLog:[];
  if(p.marketingMax&&typeof p.marketingMax==='object') state.marketingMax=p.marketingMax;
  if(typeof migrateMarketingMax==='function') migrateMarketingMax();
  if(p.marketingSocial&&typeof p.marketingSocial==='object') state.marketingSocial=p.marketingSocial;
  if(typeof migrateMarketingSocial==='function') migrateMarketingSocial();
  state.dataEpoch=Number(p.dataEpoch)||0;
  if(typeof mergeAdminAuthFromRemote==='function') mergeAdminAuthFromRemote(p, opts);
  if(!(state.finance.markupPercent>=0)) state.finance.markupPercent=15;
  if(state.finance.markupPercent>80) state.finance.markupPercent=80;
  if(!(state.finance.cityKmThreshold>0)) state.finance.cityKmThreshold=100;
  if(!(state.finance.minWorkHours>=0)) state.finance.minWorkHours=4;
  if(!(state.finance.podachaHours>=0)) state.finance.podachaHours=1;
  if(!(state.finance.podachaEmptyKmLimit>0)) state.finance.podachaEmptyKmLimit=20;
  if(!(state.finance.defaultRatePerHourWork>=0)) state.finance.defaultRatePerHourWork=0;
  if(!(state.finance.defaultRatePerKmCash>0)) state.finance.defaultRatePerKmCash=80;
  state.finance=normalizeFinance(state.finance);
  // Только если поле orders вообще отсутствовало в старых дампах.
  if(!('orders' in p) && state.shifts.length && !state.orders.length){
    state.orders=stripCancelledFromOrders(state.shifts.flatMap(s=>s.orders||[]));
  }
  if(keepShifts && typeof mergeLocalShifts==='function') mergeLocalShifts(keepShifts);
  if(keepOrders && typeof mergeLocalOrders==='function') mergeLocalOrders(keepOrders);
  state.orders=stripCancelledFromOrders(state.orders);
  state.orders.forEach(o=>{
    if(o.customer==null) o.customer="";
    if(o.driverPercent==null && typeof driverPercent==='function') o.driverPercent=driverPercent(o.driverName||DRIVER);
    ensureRoutePoints(o);
  });
  if(typeof migrateCompanies==='function') migrateCompanies();
  if(typeof migrateContractsRegistry==='function') migrateContractsRegistry();
  if(typeof migrateAdmins==='function') migrateAdmins();
  if(typeof migrateRolesTariffsFinal==='function'&&migrateRolesTariffsFinal()) bumpDataEpoch('roles-tariffs-final');
  migrateDriverOwners();
  migrateSpaces();
  if(typeof migrateBilling==='function') migrateBilling();
  if(typeof migrateDriverOrderOwners==='function') migrateDriverOrderOwners();
  if(typeof migrateRepairOrderOwnersBySpace==='function') migrateRepairOrderOwnersBySpace();
  if(typeof migrateShiftOwners==='function') migrateShiftOwners();
  migrateDriverPins();
  migrateCompanyFinance();
  if(typeof healVehicleOdometersFromShifts==='function') healVehicleOdometersFromShifts();
  if(typeof ensureManufacturerServiceIntervals==='function') ensureManufacturerServiceIntervals();
  if(typeof migrateEtoFromMessages==='function') migrateEtoFromMessages();
  // Заказы только в смене (потерялись из state.orders) — поднять в общий список
  (state.shifts||[]).forEach(s=>{
    (s.orders||[]).forEach(o=>{
      if(!o||!o.id) return;
      if(deletedOrderIdSet().has(o.id)) return;
      if(!(state.orders||[]).some(x=>x.id===o.id)){
        state.orders.push(o);
      }
    });
  });
  state.orders=stripCancelledFromOrders(state.orders);
  // Наоборот: заказы в списке, но выпали из смены — вернуть в смену + чат
  if(typeof healOrphanOrdersIntoShifts==='function') healOrphanOrdersIntoShifts();
  healAllOrders();
  migrateArmadaSxOrderReqs();
  purgeCancelledOrders();
  if(typeof pruneInvoicesForDeletedOrders==='function') pruneInvoicesForDeletedOrders();
  if(typeof migrateRestoreNechaevDriver==='function') migrateRestoreNechaevDriver();
  purgeDeletedDrivers();
  syncSequentialCounter();
  if(typeof syncAdminAsDriverNav==='function') syncAdminAsDriverNav();
  if(typeof armadaSyncEntryBranding==='function') armadaSyncEntryBranding();
}
/** Водитель без владельца → админ с тем же ФИО (после migrateAdmins). */
function migrateDriverOwners(){
  let changed=false;
  (state.drivers||[]).forEach(d=>{
    if(d.ownerAdminId) return;
    const adm=(state.admins||[]).find(a=>samePersonName(a.name, d.name));
    if(adm){ d.ownerAdminId=adm.id; d.ownerAdminName=adm.name; changed=true; }
  });
  return changed;
}
function defaultFirmNameForAdmin(adminName){
  const n=(adminName||'').trim().toLowerCase();
  if(n.includes('нечаев')) return 'ИП Нечаев А.С.';
  if(n.includes('наволоцк')) return 'ООО «Армада»';
  return adminName||'Фирма';
}
function slugifyPortalSlug(name, id){
  let s=String(name||'').trim().toLowerCase()
    .replace(/^(ооо|ип|ооо\s+|ип\s+)\s*/i,'')
    .replace(/[«»"'„]/g,'')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'')
    .slice(0,24);
  if(s.length>=3 && /^[a-z0-9][a-z0-9-]*$/.test(s)) return s;
  const tail=String(id||'').replace(/-/g,'').slice(0,8);
  return 'p'+(tail||'x');
}
function findSpaceByPortalSlug(slug){
  const s=String(slug||'').trim().toLowerCase();
  if(!s) return null;
  return (state.spaces||[]).find(sp=>String(sp.portalSlug||'').toLowerCase()===s)||null;
}
function normalizeRouteTemplate(t){
  if(!t||typeof t!=='object') return null;
  const load=String(t.loadingAddress||'').trim();
  const unload=String(t.unloadingAddress||'').trim();
  const name=String(t.name||'').trim();
  if(!name||!load||!unload) return null;
  return {
    id:t.id||uuid(),
    name,
    loadingAddress:load,
    unloadingAddress:unload,
    loadingContactName:String(t.loadingContactName||'').trim(),
    loadingContactPhone:String(t.loadingContactPhone||'').trim(),
    unloadingContactName:String(t.unloadingContactName||'').trim(),
    unloadingContactPhone:String(t.unloadingContactPhone||'').trim(),
    createdAt:t.createdAt||new Date().toISOString()
  };
}
function routeTemplatesForSpace(spaceId){
  const sp=findSpaceById(spaceId);
  if(!sp) return [];
  return (Array.isArray(sp.routeTemplates)?sp.routeTemplates:[])
    .map(normalizeRouteTemplate).filter(Boolean)
    .sort((a,b)=>String(a.name).localeCompare(String(b.name),'ru'));
}
function upsertRouteTemplate(spaceId, raw){
  const sp=findSpaceById(spaceId);
  if(!sp) return {ok:false, message:'Нет пространства фирмы'};
  const tpl=normalizeRouteTemplate(Object.assign({}, raw, {id:raw&&raw.id||uuid()}));
  if(!tpl) return {ok:false, message:'Укажите название и оба адреса'};
  const list=routeTemplatesForSpace(spaceId).filter(t=>t.id!==tpl.id);
  list.push(tpl);
  sp.routeTemplates=list;
  if(typeof bumpDataEpoch==='function') bumpDataEpoch('route-template');
  if(typeof persist==='function') persist();
  return {ok:true, template:tpl};
}
function deleteRouteTemplate(spaceId, templateId){
  const sp=findSpaceById(spaceId);
  if(!sp) return {ok:false, message:'Нет пространства фирмы'};
  const before=routeTemplatesForSpace(spaceId).length;
  sp.routeTemplates=routeTemplatesForSpace(spaceId).filter(t=>t.id!==templateId);
  if(sp.routeTemplates.length===before) return {ok:false, message:'Шаблон не найден'};
  if(typeof bumpDataEpoch==='function') bumpDataEpoch('route-template');
  if(typeof persist==='function') persist();
  return {ok:true};
}
function normalizeSpace(s){
  if(!s||typeof s!=='object') return null;
  const id=s.id||uuid();
  const name=String(s.name||'').trim(); if(!name) return null;
  let portalSlug=String(s.portalSlug||'').trim().toLowerCase()
    .replace(/[^a-z0-9-]/g,'').replace(/^-+|-+$/g,'').slice(0,32);
  if(!portalSlug) portalSlug=slugifyPortalSlug(name, id);
  const portalLogo=String(s.portalLogo||'').trim();
  const routeTemplates=(Array.isArray(s.routeTemplates)?s.routeTemplates:[])
    .map(normalizeRouteTemplate).filter(Boolean);
  const out={
    id, name,
    portalSlug,
    portalLogo:portalLogo.startsWith('data:image')?portalLogo:'',
    inn:String(s.inn||'').trim(),
    ogrn:String(s.ogrn||'').trim(),
    kpp:String(s.kpp||'').trim(),
    address:String(s.address||'').trim(),
    director:String(s.director||'').trim(),
    adminId:s.adminId||null,
    adminName:String(s.adminName||'').trim(),
    ownCompanyId:s.ownCompanyId||null,
    routeTemplates,
    createdAt:s.createdAt||new Date().toISOString()
  };
  const ck=String(s.cabinetKind||'').trim();
  if(ck) out.cabinetKind=ck;
  if(s.productTariffId) out.productTariffId=s.productTariffId;
  if(s.ownerDriverTariffId) out.ownerDriverTariffId=s.ownerDriverTariffId;
  if(s.moduleOverrides&&typeof s.moduleOverrides==='object') out.moduleOverrides=s.moduleOverrides;
  if(s.ownerPaidUntil) out.ownerPaidUntil=s.ownerPaidUntil;
  if(s.ownerPilotEndsAt) out.ownerPilotEndsAt=s.ownerPilotEndsAt;
  if(s.theme&&typeof s.theme==='object'&&typeof normalizeSpaceThemeConfig==='function'){
    const th=normalizeSpaceThemeConfig(s.theme);
    if(th) out.theme=th;
  }else if(s.theme===null) out.theme=null;
  return out;
}
function findCompanyById(id){
  return (state.companies||[]).find(c=>c.id===id)||null;
}
function findSpaceById(id){ return (state.spaces||[]).find(s=>s.id===id)||null; }
function currentSpaceId(){ return (currentAdmin&&currentAdmin.spaceId)||null; }
function personSurnameKey(name){
  const parts=String(name||'').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if(!parts.length) return '';
  return parts[0].replace(/\./g,'');
}
function personInitials(name){
  const parts=String(name||'').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if(parts.length<2) return '';
  return parts.slice(1).map(p=>p.replace(/\./g,'').charAt(0)).join('');
}
/** «Нечаев» и «Нечаев А.С.» — один человек (PIN админа ↔ водитель). */
function samePersonName(a,b){
  const na=String(a||'').trim().toLowerCase();
  const nb=String(b||'').trim().toLowerCase();
  if(!na||!nb) return false;
  if(na===nb) return true;
  const sa=personSurnameKey(na);
  const sb=personSurnameKey(nb);
  if(sa.length<3||sb.length<3||sa!==sb) return false;
  const ia=personInitials(na);
  const ib=personInitials(nb);
  if(!ia||!ib) return true;
  return ia.charAt(0)===ib.charAt(0);
}
function adminMirrorDriverBlocked(adm, co){
  if(!adm||!co) return true;
  if(adm.skipDriverMirror) return true;
  return isDriverDeleted(adm.name, co.id);
}
/** PIN админа → водительские профили; при восстановлении доступа — сразу на сервер. */
function syncAdminAuthToDrivers(adm){
  if(!adm||!adm.id) return false;
  if(typeof migrateSpaces==='function') migrateSpaces();
  let changed=false;
  const pin=String(adm.pin||'').trim();
  const co=typeof ownCompanyForAdminId==='function'?ownCompanyForAdminId(adm.id):null;
  const sp=findSpaceById(adm.spaceId);
  const existing=(state.drivers||[]).find(d=>samePersonName(d.name, adm.name));
  const driverName=existing?existing.name:adm.name;
  if(co && !adminMirrorDriverBlocked(adm, co) && ensureDriverInCompany({
    name:driverName, companyId:co.id, companyName:co.name,
    spaceId:adm.spaceId||co.spaceId||null,
    ownerAdminId:adm.id, ownerAdminName:adm.name,
    pin:pin.length>=4?pin:'',
    phone:adm.phone||''
  })) changed=true;
  (state.drivers||[]).forEach(d=>{
    if(!samePersonName(d.name, adm.name)) return;
    if(pin.length>=4 && String(d.pin||'').trim()!==pin){ d.pin=pin; changed=true; }
    if(adm.phone && formatPhone(d.phone||'')!==formatPhone(adm.phone)){ d.phone=formatPhone(adm.phone); changed=true; }
    if(!d.ownerAdminId){ d.ownerAdminId=adm.id; d.ownerAdminName=adm.name; changed=true; }
    if(adm.spaceId && co && (!d.companyId || d.companyId===co.id || d.ownerAdminId===adm.id)){
      if(d.spaceId!==adm.spaceId){ d.spaceId=adm.spaceId; changed=true; }
      if(d.companyId!==co.id){ d.companyId=co.id; d.companyName=co.name; changed=true; }
    }
  });
  if(existing && existing.name.length>String(adm.name||'').length && existing.name!==adm.name){
    adm.name=existing.name;
    if(sp) sp.adminName=existing.name;
    changed=true;
  }
  if(changed && typeof bumpDataEpoch==='function') bumpDataEpoch('admin-driver-sync');
  return changed;
}
/** «Наша фирма» пространства — у каждого админа своя. */
function ensureOwnCompanyForSpace(space){
  if(!space) return null;
  if(space.ownCompanyId){
    const existing=findCompanyById(space.ownCompanyId);
    if(existing){
      if(existing.spaceId!==space.id) existing.spaceId=space.id;
      if(!companyHasRole(existing,'own')){
        const roles=(existing.roles||[]).slice();
        if(!roles.includes('own')) roles.push('own');
        return upsertCompany(Object.assign({}, existing, {roles, spaceId:space.id}));
      }
      return existing;
    }
    // ownCompanyId есть, а компании нет (удалили/потеряли) — восстанавливаем с тем же id
    const restored=upsertCompany({
      id:space.ownCompanyId,
      name:space.name, roles:['own'], note:space.inn?`ИНН ${space.inn}`:'',
      contacts:[], phones:[], loadingAddresses:[], unloadingAddresses:[], vehicles:[], drivers:[],
      spaceId:space.id, inn:space.inn, ogrn:space.ogrn, kpp:space.kpp, address:space.address
    });
    if(restored) return restored;
  }
  let co=(state.companies||[]).find(c=>c.spaceId===space.id && companyHasRole(c,'own'));
  if(!co){
    co=(state.companies||[]).find(c=>c.spaceId===space.id && (c.name||'').trim().toLowerCase()===(space.name||'').trim().toLowerCase());
    if(co){
      const roles=(co.roles||[]).slice();
      if(!roles.includes('own')) roles.push('own');
      co=upsertCompany(Object.assign({}, co, {roles, spaceId:space.id}));
    }
  }
  if(!co){
    co=upsertCompany({
      name:space.name, roles:['own'], note:space.inn?`ИНН ${space.inn}`:'',
      contacts:[], phones:[], loadingAddresses:[], unloadingAddresses:[], vehicles:[], drivers:[],
      spaceId:space.id, inn:space.inn, ogrn:space.ogrn, kpp:space.kpp, address:space.address
    });
  } else {
    if(co.spaceId!==space.id) co.spaceId=space.id;
    if(!companyHasRole(co,'own')){
      const roles=(co.roles||[]).slice();
      roles.push('own');
      co=upsertCompany(Object.assign({}, co, {roles, spaceId:space.id}));
    }
  }
  if(co) space.ownCompanyId=co.id;
  return co||null;
}
/** Водитель с таким ФИО уже есть именно в этой фирме (в другой фирме — можно). */
function driverExistsInCompany(name, companyId){
  if(!companyId) return (state.drivers||[]).some(d=>samePersonName(d.name,name));
  return (state.drivers||[]).some(d=>samePersonName(d.name,name) && d.companyId===companyId);
}
function ensureDriverInCompany(opts){
  const name=String(opts.name||'').trim();
  const companyId=opts.companyId;
  if(!name||!companyId) return false;
  if(driverExistsInCompany(name, companyId)) return false;
  if(isDriverDeleted(name, companyId)) return false;
  const billSpaceId=opts.spaceId||null;
  if(billSpaceId&&typeof billingGuard==='function'){
    const g=billingGuard(billSpaceId,'add_driver');
    if(!g.ok) return false;
  }
  state.drivers.push({
    id:uuid(),
    name,
    salaryPercent:opts.salaryPercent??30,
    exchangeEnabled:!!opts.exchangeEnabled,
    phone:formatPhone(opts.phone||''),
    pin:String(opts.pin||'').trim(),
    ownerAdminId:opts.ownerAdminId||null,
    ownerAdminName:opts.ownerAdminName||null,
    spaceId:opts.spaceId||null,
    companyId,
    companyName:opts.companyName||null
  });
  return true;
}
/** PIN водителя: свой → PIN админа с тем же ФИО → последние 4 цифры телефона. */
function resolveDriverPin(d){
  if(!d) return '';
  const own=String(d.pin||'').trim();
  if(own.length>=4) return own;
  const adm=(state.admins||[]).find(a=>samePersonName(a.name, d.name));
  if(adm && String(adm.pin||'').trim().length>=4) return String(adm.pin).trim();
  const ph=formatPhone(d.phone||'');
  if(ph.length>=4) return ph.slice(-4);
  return '';
}
function migrateDriverPins(){
  let changed=false;
  (state.drivers||[]).forEach(d=>{
    if(!d) return;
    if(String(d.pin||'').trim().length>=4) return;
    const adm=(state.admins||[]).find(a=>samePersonName(a.name, d.name));
    if(adm && String(adm.pin||'').trim().length>=4){
      d.pin=String(adm.pin).trim(); changed=true; return;
    }
    const ph=formatPhone(d.phone||'');
    if(ph.length>=4){ d.pin=ph.slice(-4); changed=true; }
  });
  return changed;
}
function findDriversByPhone(phone){
  const p=formatPhone(phone);
  if(!p) return [];
  return (state.drivers||[]).filter(d=>formatPhone(d.phone||'')===p);
}
function driverInviteKey(d){
  if(!d) return '';
  return `${String(d.name||'').trim()}|${d.companyId||''}`;
}
function findValidDriverInvite(token){
  if(!token) return null;
  const inv=(state.driverInvites||[]).find(x=>x&&x.token===token && !x.usedAt && !x.revokedAt);
  if(!inv) return null;
  if(inv.expiresAt && new Date(inv.expiresAt).getTime()<Date.now()) return null;
  return inv;
}
function driverInvitePageUrl(token){
  const dir=location.pathname.replace(/[^/]*$/,'');
  return `${location.origin}${dir}invite.html?token=${encodeURIComponent(token)}`;
}
async function createDriverInvite(driverIndex){
  const d=(state.drivers||[])[driverIndex];
  if(!d) return {ok:false, message:'Водитель не найден'};
  const phone=formatPhone(d.phone||'');
  if(!phone) return {ok:false, message:'Укажите телефон водителя'};
  if(currentAdmin && typeof billingGuardCurrentAdminWithServer==='function'){
    const g=await billingGuardCurrentAdminWithServer('add_driver');
    if(!g.ok) return {ok:false, message:g.message};
  }
  if(!state.driverInvites) state.driverInvites=[];
  const key=driverInviteKey(d);
  state.driverInvites.forEach(inv=>{
    if(inv && inv.driverKey===key && !inv.usedAt && !inv.revokedAt) inv.revokedAt=new Date().toISOString();
  });
  const token=uuid();
  const inv={
    id:uuid(), token, driverKey:key,
    driverName:String(d.name||'').trim(),
    companyId:d.companyId||null,
    spaceId:d.spaceId||null,
    phone,
    createdAt:new Date().toISOString(),
    expiresAt:new Date(Date.now()+DRIVER_INVITE_TTL_MS).toISOString(),
    createdByAdminId:currentAdmin&&currentAdmin.id,
    createdByAdminName:currentAdmin&&currentAdmin.name,
    usedAt:null, revokedAt:null
  };
  state.driverInvites.push(inv);
  bumpDataEpoch('driver-invite');
  persist();
  return {ok:true, invite:inv, url:driverInvitePageUrl(token)};
}
function consumeDriverInvite(token, pin){
  const inv=findValidDriverInvite(token);
  if(!inv) return {ok:false, message:'Ссылка недействительна, истекла или уже использована'};
  const pinStr=String(pin||'').trim();
  if(pinStr.length<4) return {ok:false, message:'PIN — минимум 4 цифры'};
  const rec=findDriverRecord(inv.driverName, inv.companyId);
  if(!rec) return {ok:false, message:'Водитель не найден — обратитесь к администратору'};
  if(formatPhone(rec.phone||'')!==inv.phone) return {ok:false, message:'Телефон водителя изменился — запросите новую ссылку'};
  rec.pin=pinStr;
  inv.usedAt=new Date().toISOString();
  bumpDataEpoch('driver-invite-used');
  persist();
  return {ok:true, driver:rec};
}
function pickDriverHomeRecord(list){
  if(!list||!list.length) return null;
  const home=list.find(d=>{
    const adm=(state.admins||[]).find(a=>a.id===d.ownerAdminId);
    return adm && samePersonName(adm.name, d.name);
  });
  return home||list[0];
}
/** Подтянуть companyName/spaceId у водителей и авто из справочника компаний. */
function migrateSyncDriverCompanyNames(){
  let changed=false;
  (state.drivers||[]).forEach(d=>{
    if(!d) return;
    const co=d.companyId&&findCompanyById(d.companyId);
    if(co){
      if(d.companyName!==co.name){ d.companyName=co.name; changed=true; }
      if(co.spaceId && d.spaceId!==co.spaceId){ d.spaceId=co.spaceId; changed=true; }
      return;
    }
    if(d.companyId && !co){ d.companyId=null; d.companyName=null; changed=true; }
  });
  (state.vehicles||[]).forEach(v=>{
    if(!v||!v.companyId) return;
    const co=findCompanyById(v.companyId);
    if(co && v.companyName!==co.name){ v.companyName=co.name; changed=true; }
  });
  return changed;
}
/** Парк (водители/авто) — отдельно на каждую «нашу фирму». */
function ensureFleetPerSpaces(){
  let changed=false;
  if(migrateSyncDriverCompanyNames()) changed=true;
  // Старые «общие» водители без фирмы — привязать к фирме владельца/админа с тем же ФИО
  (state.drivers||[]).forEach(d=>{
    if(d.companyId && findCompanyById(d.companyId)) return;
    const adm=(state.admins||[]).find(a=>a.id===d.ownerAdminId)
      || (state.admins||[]).find(a=>samePersonName(a.name, d.name));
    if(!adm) return;
    const co=ownCompanyForAdminId(adm.id);
    if(!co) return;
    d.ownerAdminId=adm.id;
    d.ownerAdminName=adm.name;
    d.spaceId=adm.spaceId||co.spaceId||null;
    d.companyId=co.id;
    d.companyName=co.name;
    changed=true;
  });
  (state.spaces||[]).forEach(sp=>{
    const co=ensureOwnCompanyForSpace(sp);
    if(!co) return;
    const fleetCoId=sp.ownCompanyId&&findCompanyById(sp.ownCompanyId)?sp.ownCompanyId:co.id;
    const fleetCo=findCompanyById(fleetCoId)||co;
    if(co.spaceId!==sp.id){ co.spaceId=sp.id; changed=true; }
    (state.drivers||[]).forEach(d=>{
      if(d.spaceId===sp.id && !d.companyId){
        d.companyId=fleetCo.id; d.companyName=fleetCo.name; changed=true;
      }
    });
    (state.vehicles||[]).forEach(v=>{
      if(v.spaceId!==sp.id) return;
      if(v.companyId!==fleetCo.id || v.companyName!==fleetCo.name){
        v.companyId=fleetCo.id; v.companyName=fleetCo.name; changed=true;
      }
    });
    const adm=(state.admins||[]).find(a=>a.id===sp.adminId)
      || (state.admins||[]).find(a=>a.spaceId===sp.id);
    if(adm && co && !adminMirrorDriverBlocked(adm, co) && ensureDriverInCompany({
      name:adm.name, companyId:co.id, companyName:co.name, spaceId:sp.id,
      ownerAdminId:adm.id, ownerAdminName:adm.name
    })) changed=true;
    // Пустой парк — нормально; авто добавляют вручную в «Справочники → Авто».
  });
  // Телефоны: из контактов «нашей фирмы» / других копий того же ФИО
  (state.drivers||[]).forEach(d=>{
    if((d.phone||'').trim()) return;
    let ph='';
    const co=findCompanyById(d.companyId);
    if(co){
      for(const p of (co.contacts||[])){
        if(samePersonName(p.name, d.name)){ ph=contactPhone(p); if(ph) break; }
      }
    }
    if(!ph){
      const twin=(state.drivers||[]).find(x=>samePersonName(x.name,d.name) && (x.phone||'').trim());
      if(twin) ph=String(twin.phone).trim();
    }
    if(!ph){
      for(const c of (state.companies||[])){
        if(!companyHasRole(c,'own')) continue;
        for(const p of (c.contacts||[])){
          if(samePersonName(p.name, d.name)){ ph=contactPhone(p); if(ph) break; }
        }
        if(ph) break;
      }
    }
    if(ph){ d.phone=formatPhone(ph); changed=true; }
  });
  if(normalizeAllPhones()) changed=true;
  return changed;
}
function ownCompanyForSpaceId(spaceId){
  const sp=findSpaceById(spaceId);
  return sp?ensureOwnCompanyForSpace(sp):null;
}
function ownCompanyForAdminId(adminId){
  const adm=(state.admins||[]).find(a=>a.id===adminId);
  if(!adm||!adm.spaceId) return null;
  return ownCompanyForSpaceId(adm.spaceId);
}
function currentOwnCompany(){
  if(!currentAdmin) return null;
  if(typeof isSuperAdmin==='function'&&isSuperAdmin()&&typeof catalogViewSpaceId==='function'){
    const view=catalogViewSpaceId();
    if(view){
      const bySpace=ownCompanyForSpaceId(view);
      if(bySpace) return bySpace;
    }
  }
  return ownCompanyForAdminId(currentAdmin.id) || ownCompanyForSpaceId(currentSpaceId());
}
function currentAdminOwnCompanyId(){
  const co=currentOwnCompany();
  return co?co.id:'';
}
function ownCompaniesList(){
  return (state.companies||[]).filter(c=>companyHasRole(c,'own'));
}
/** Тариф фирмы. Заказы и расчёты берут настройки «нашей фирмы» заказа. */
function financeForCompanyId(companyId){
  const co=companyId?findCompanyById(companyId):null;
  if(co && co.finance) return normalizeFinance(co.finance);
  return normalizeFinance(state.finance);
}
function financeForOrder(o){
  const id=o&&(o.ownCompanyId||null);
  if(id) return financeForCompanyId(id);
  const my=currentOwnCompany();
  if(my) return financeForCompanyId(my.id);
  return normalizeFinance(state.finance);
}
function driverTombstoneKey(name, companyId){
  return `${String(name||'').trim().toLowerCase()}|${companyId||''}`;
}
function markDriverDeleted(d){
  if(!d) return;
  if(!Array.isArray(state.deletedDriverKeys)) state.deletedDriverKeys=[];
  const key=driverTombstoneKey(d.name, d.companyId);
  if(!state.deletedDriverKeys.includes(key)) state.deletedDriverKeys.push(key);
}
function unmarkDriverDeleted(name, companyId){
  if(!Array.isArray(state.deletedDriverKeys)) return false;
  const key=driverTombstoneKey(name, companyId);
  const i=state.deletedDriverKeys.indexOf(key);
  if(i<0) return false;
  state.deletedDriverKeys.splice(i,1);
  return true;
}
function restoreDriverInCompany(opts){
  const name=String(opts.name||'').trim();
  const companyId=opts.companyId;
  if(!name||!companyId) return false;
  unmarkDriverDeleted(name, companyId);
  return ensureDriverInCompany(opts);
}
function isDriverDeleted(name, companyId){
  return (state.deletedDriverKeys||[]).includes(driverTombstoneKey(name, companyId));
}
/** Вернуть Нечаева А.С. в ИП Нечаев (tombstone после удаления в справочнике). */
function migrateRestoreNechaevDriver(){
  const CANON='Нечаев А.С.';
  const adm=(state.admins||[]).find(a=>samePersonName(a.name, CANON));
  const name=adm?String(adm.name||'').trim():CANON;
  if(!name) return false;
  const owns=(typeof ownCompaniesList==='function'?ownCompaniesList():[])
    .filter(c=>(c.name||'').toLowerCase().includes('нечаев'));
  let co=owns[0]||null;
  if(!co&&adm&&adm.spaceId){
    const sp=findSpaceById(adm.spaceId);
    if(sp) co=ensureOwnCompanyForSpace(sp);
  }
  if(!co) return false;
  let changed=false;
  (state.deletedDriverKeys||[]).slice().forEach(key=>{
    const sep=key.lastIndexOf('|');
    if(sep<0) return;
    const nm=key.slice(0, sep);
    const cid=key.slice(sep+1);
    if(cid===co.id && nm.includes('нечаев') && unmarkDriverDeleted(nm, co.id)) changed=true;
  });
  if(driverExistsInCompany(name, co.id)) return changed;
  const def=DEFAULT_DRIVERS.find(d=>samePersonName(d.name, CANON))||{};
  if(restoreDriverInCompany({
    name, companyId:co.id, companyName:co.name,
    spaceId:co.spaceId||adm?.spaceId||null,
    ownerAdminId:adm?.id||null, ownerAdminName:adm?.name||null,
    salaryPercent:def.salaryPercent??30,
    exchangeEnabled:!!def.exchangeEnabled,
    phone:def.phone||adm?.phone||''
  })) changed=true;
  return changed;
}
function purgeDeletedDrivers(){
  if(!Array.isArray(state.drivers)) return false;
  const before=state.drivers.length;
  state.drivers=state.drivers.filter(d=>!isDriverDeleted(d.name, d.companyId));
  return state.drivers.length!==before;
}
/** Водители как во вкладке «Справочники → Водители». */
function catalogDriverCompany(){
  const inSpace=(c)=>typeof companyInMySpace==='function'?companyInMySpace(c):true;
  const owns=(typeof ownCompaniesList==='function'?ownCompaniesList():[]).filter(inSpace);
  if(catalogDriverCompanyId){
    const hit=findCompanyById(catalogDriverCompanyId);
    if(hit && companyHasRole(hit,'own') && inSpace(hit)) return hit;
  }
  const my=typeof currentOwnCompany==='function'?currentOwnCompany():null;
  if(my) return my;
  return owns[0]||null;
}
function catalogFinanceCompany(){
  const inSpace=(c)=>typeof companyInMySpace==='function'?companyInMySpace(c):true;
  if(catalogFinanceCompanyId){
    const hit=findCompanyById(catalogFinanceCompanyId);
    if(hit && companyHasRole(hit,'own') && inSpace(hit)) return hit;
  }
  if(catalogActiveCompanyId){
    const active=findCompanyById(catalogActiveCompanyId);
    if(active && companyHasRole(active,'own') && inSpace(active)) return active;
  }
  const my=typeof currentOwnCompany==='function'?currentOwnCompany():null;
  if(my && inSpace(my)) return my;
  const list=typeof catalogOwnCompaniesInView==='function'?catalogOwnCompaniesInView()
    :ownCompaniesList().filter(inSpace);
  return list[0]||null;
}
/** Раздать общий тариф по «нашим фирмам», если у фирмы ещё нет своего. */
function migrateCompanyFinance(){
  let changed=false;
  const seed=normalizeFinance(state.finance);
  (state.companies||[]).forEach(c=>{
    if(!companyHasRole(c,'own')) return;
    if(!c.finance){ c.finance=Object.assign({}, seed); changed=true; }
    else c.finance=normalizeFinance(c.finance);
  });
  return changed;
}
/** Собственник-водитель: space + фирма + водитель + 1 ТС (без админа /a/). */
function createOwnerDriverCabinet(opts){
  const o=opts&&typeof opts==='object'?opts:{};
  const name=String(o.name||'').trim();
  const phone=formatPhone(o.phone||'');
  const pin=String(o.pin||'').trim();
  const plate=String(o.plate||'').trim();
  if(!name||!phone||pin.length<4||!plate){
    return { ok:false, error:'missing_fields' };
  }
  const space=normalizeSpace({
    id:uuid(),
    name:String(o.firmName||'').trim()||defaultFirmNameForAdmin(name),
    inn:String(o.inn||'').trim(),
    cabinetKind:'owner_driver',
    productTariffId:'owner_basic',
    createdAt:new Date().toISOString()
  });
  const trialEnds=new Date(Date.now()+30*86400000).toISOString();
  space.ownerPilotEndsAt=trialEnds;
  space.ownerPaidUntil=trialEnds;
  state.spaces=(state.spaces||[]).concat([space]);
  ensureOwnCompanyForSpace(space);
  const co=typeof ownCompanyForSpaceId==='function'?ownCompanyForSpaceId(space.id):null;
  if(!co) return { ok:false, error:'no_own_company' };
  const driver={
    id:uuid(),
    name,
    phone,
    pin,
    accountKind:'owner_driver',
    spaceId:space.id,
    companyId:co.id,
    companyName:co.name
  };
  state.drivers=(state.drivers||[]).concat([driver]);
  const vehicle={
    id:uuid(),
    plate,
    makeModel:String(o.makeModel||'').trim(),
    spaceId:space.id,
    companyId:co.id,
    consumptionPer100Km:20
  };
  state.vehicles=(state.vehicles||[]).concat([vehicle]);
  driver.vehicleId=vehicle.id;
  if(typeof bumpDataEpoch==='function') bumpDataEpoch('create-owner-driver');
  return { ok:true, space, driver, vehicle, company:co };
}
function createSpaceForAdmin(admin, firm){
  const space=normalizeSpace({
    id:uuid(),
    name:(firm&&firm.name)||defaultFirmNameForAdmin(admin.name),
    inn:(firm&&firm.inn)||'',
    ogrn:(firm&&firm.ogrn)||'',
    kpp:(firm&&firm.kpp)||'',
    address:(firm&&firm.address)||'',
    director:(firm&&firm.director)||'',
    adminId:admin.id,
    adminName:admin.name,
    createdAt:new Date().toISOString()
  });
  state.spaces=(state.spaces||[]).concat([space]);
  if(typeof bootstrapPilotSpace==='function') bootstrapPilotSpace(space.id);
  else if(typeof getBillingForSpace==='function') getBillingForSpace(space.id);
  admin.spaceId=space.id;
  ensureOwnCompanyForSpace(space);
  return space;
}
function ensureAdminDriverMirror(adm, opts){
  if(!adm||!adm.spaceId) return false;
  const co=typeof ownCompanyForSpaceId==='function'?ownCompanyForSpaceId(adm.spaceId):null;
  if(!co||adminMirrorDriverBlocked(adm, co)) return false;
  if(typeof unmarkDriverDeleted==='function') unmarkDriverDeleted(adm.name, co.id);
  adm.skipDriverMirror=false;
  return ensureDriverInCompany(Object.assign({
    name:adm.name, companyId:co.id, companyName:co.name, spaceId:adm.spaceId,
    ownerAdminId:adm.id, ownerAdminName:adm.name,
    phone:adm.phone||'', pin:String(adm.pin||'').trim()
  }, opts||{}));
}
/** У каждого админа — пространство + своя «наша фирма»; водители/авто к ней. */
/** Автозаглушки парка (legacy seed) — не настоящие машины. */
function isAutoSeedVehiclePlate(plate){
  const p=typeof normPlateKey==='function'?normPlateKey(plate):String(plate||'').toLowerCase().replace(/\s+/g,'');
  if(!p) return false;
  if(p==='к001кк47') return true;
  return /^х\d{3}хх47$/.test(p);
}
function vehiclePlateInUse(plate){
  const key=typeof normPlateKey==='function'?normPlateKey(plate):String(plate||'').toLowerCase().replace(/\s+/g,'');
  if(!key) return false;
  const matchPl=(p)=>typeof normPlateKey==='function'?normPlateKey(p)===key:String(p||'').toLowerCase().replace(/\s+/g,'')===key;
  if((state.orders||[]).some(o=>matchPl(o.vehiclePlate)||matchPl(o.bookedPlate))) return true;
  if((state.shifts||[]).some(s=>matchPl(s.vehiclePlate))) return true;
  if((state.drivers||[]).some(d=>{
    if(!d.vehicleId) return false;
    const v=(state.vehicles||[]).find(x=>x.id===d.vehicleId);
    return v&&matchPl(v.plate);
  })) return true;
  return false;
}
/** Админ явно удалил зеркало водителя — не создавать снова. */
function migrateAdminSkipDriverMirror(){
  let changed=false;
  (state.admins||[]).forEach(adm=>{
    const co=typeof ownCompanyForAdminId==='function'?ownCompanyForAdminId(adm.id):null;
    if(!co) return;
    if(isDriverDeleted(adm.name, co.id) && !adm.skipDriverMirror){
      adm.skipDriverMirror=true;
      changed=true;
    }
  });
  return changed;
}
/** Удалить автосозданные заглушки без заказов и смен. */
function migrateRemoveAutoSeedVehicles(){
  let changed=false;
  const before=(state.vehicles||[]).length;
  state.vehicles=(state.vehicles||[]).filter(v=>{
    if(!v||!isAutoSeedVehiclePlate(v.plate)) return true;
    if(vehiclePlateInUse(v.plate)) return true;
    changed=true;
    return false;
  });
  if(changed && typeof bumpDataEpoch==='function') bumpDataEpoch('purge-auto-seed-vehicles');
  return changed || before!==(state.vehicles||[]).length;
}
/** Водитель с ФИО админа другого кабинета не должен висеть в чужом space (legacy). */
function migratePurgeCrossTenantGhostDrivers(){
  let changed=false;
  const admins=(state.admins||[]).filter(a=>a&&a.spaceId);
  (state.drivers||[]).slice().forEach(d=>{
    if(!d||!d.name) return;
    const home=admins.find(a=>samePersonName(a.name, d.name));
    if(!home||!home.spaceId) return;
    if(d.spaceId===home.spaceId) return;
    const hasHomeCopy=(state.drivers||[]).some(x=>x!==d && samePersonName(x.name,d.name) && x.spaceId===home.spaceId);
    if(!hasHomeCopy && d.ownerAdminId===home.id){
      d.spaceId=home.spaceId;
      const co=ownCompanyForSpaceId(home.spaceId);
      if(co){ d.companyId=co.id; d.companyName=co.name; }
      changed=true;
      return;
    }
    state.drivers=state.drivers.filter(x=>x!==d);
    changed=true;
  });
  return changed;
}
/** Снять «Наша фирма» у записей в чужом кабинете (legacy: МБН/Нечаев в справочнике Армады). */
function migrateFleetToCanonicalOwnCompany(){
  let changed=false;
  (state.spaces||[]).forEach(sp=>{
    if(!sp.ownCompanyId) return;
    const canon=findCompanyById(sp.ownCompanyId);
    if(!canon) return;
    const rehome=(row, idField)=>{
      if(!row||row[idField]===canon.id) return;
      const co=findCompanyById(row[idField]);
      if(!co||co.spaceId!==sp.id) return;
      if(row.spaceId&&row.spaceId!==sp.id) return;
      row[idField]=canon.id;
      row.companyName=canon.name;
      changed=true;
    };
    (state.drivers||[]).forEach(d=>{
      if(d.spaceId===sp.id||findCompanyById(d.companyId)?.spaceId===sp.id) rehome(d,'companyId');
    });
    (state.vehicles||[]).forEach(v=>{
      if(v.spaceId===sp.id||findCompanyById(v.companyId)?.spaceId===sp.id) rehome(v,'companyId');
    });
  });
  return changed;
}
function migrateStripSpuriousOwnRoles(){
  let changed=false;
  if(migrateFleetToCanonicalOwnCompany()) changed=true;
  (state.spaces||[]).forEach(sp=>{
    if(!sp.ownCompanyId) return;
    (state.companies||[]).forEach(c=>{
      if(!companyHasRole(c,'own') || c.id===sp.ownCompanyId) return;
      if(c.spaceId===sp.id){
        c.roles=(c.roles||[]).filter(r=>r!=='own');
        if(!c.roles.length) c.roles=['customer'];
        changed=true;
      }
    });
  });
  (state.companies||[]).forEach(c=>{
    if(!companyHasRole(c,'own')) return;
    if((state.spaces||[]).some(sp=>sp.ownCompanyId===c.id)) return;
    c.roles=(c.roles||[]).filter(r=>r!=='own');
    if(!c.roles.length) c.roles=['customer'];
    changed=true;
  });
  if(changed && typeof syncCustomersFromCompanies==='function') syncCustomersFromCompanies();
  return changed;
}
function migrateSpaces(){
  state.settings=Object.assign({fnsApiKey:'',dadataToken:'',yandexMapsApiKey:''}, state.settings||{});
  state.spaces=(state.spaces||[]).map(normalizeSpace).filter(Boolean);
  let changed=false;
  const slugUsed=new Set();
  (state.spaces||[]).forEach(sp=>{
    let slug=String(sp.portalSlug||'').toLowerCase();
    if(!slug || slugUsed.has(slug)){
      slug=slugifyPortalSlug(sp.name, sp.id);
      let n=0;
      while(slugUsed.has(slug)){
        n++;
        slug=slugifyPortalSlug(sp.name, sp.id)+'-'+n;
      }
      sp.portalSlug=slug;
      changed=true;
    }
    slugUsed.add(slug);
  });
  (state.admins||[]).forEach(a=>{
    if(a.spaceId && findSpaceById(a.spaceId)) return;
    const byAdmin=state.spaces.find(s=>s.adminId===a.id);
    if(byAdmin){ a.spaceId=byAdmin.id; changed=true; return; }
    createSpaceForAdmin(a, {name:defaultFirmNameForAdmin(a.name)});
    changed=true;
  });
  (state.spaces||[]).forEach(sp=>{
    if(sp&&String(sp.cabinetKind||'')==='owner_driver'&&!sp.ownerPaidUntil&&sp.ownerPilotEndsAt){
      sp.ownerPaidUntil=sp.ownerPilotEndsAt;
      changed=true;
    }
  });
  (state.spaces||[]).forEach(sp=>{
    const before=sp.ownCompanyId;
    ensureOwnCompanyForSpace(sp);
    if(sp.ownCompanyId!==before) changed=true;
    const co=ownCompanyForSpaceId(sp.id);
    const coInn=co&&normalizeLoginInn(co.inn);
    if(coInn && normalizeLoginInn(sp.inn)!==coInn){
      sp.inn=coInn;
      changed=true;
    }
  });
  const superAdm=(state.admins||[]).find(a=>a.isSuper);
  const fallbackSpace=superAdm&&superAdm.spaceId;
  (state.companies||[]).forEach(c=>{
    if(c.spaceId) return;
    const nm=(c.name||'').toLowerCase();
    const hit=(state.spaces||[]).find(s=>(s.name||'').toLowerCase()===nm);
    if(hit){ c.spaceId=hit.id; changed=true; }
  });
  (state.drivers||[]).forEach(d=>{
    if(!d.spaceId){
      const adm=(state.admins||[]).find(x=>x.id===d.ownerAdminId);
      if(adm&&adm.spaceId){ d.spaceId=adm.spaceId; changed=true; }
      else if(fallbackSpace){ d.spaceId=fallbackSpace; changed=true; }
    }
    if(!d.companyId && d.spaceId){
      const co=ownCompanyForSpaceId(d.spaceId);
      if(co){ d.companyId=co.id; d.companyName=co.name; changed=true; }
    }
  });
  (state.vehicles||[]).forEach(v=>{
    if(!v) return;
    if(!v.spaceId && v.companyId){
      const co=findCompanyById(v.companyId);
      if(co&&co.spaceId){ v.spaceId=co.spaceId; changed=true; }
    }
    if(!v.spaceId && fallbackSpace){ v.spaceId=fallbackSpace; changed=true; }
    if(!v.companyId && v.spaceId){
      const co=ownCompanyForSpaceId(v.spaceId);
      if(co){ v.companyId=co.id; v.companyName=co.name; changed=true; }
    }
  });
  (state.orders||[]).forEach(o=>{
    if(o.spaceId) return;
    const adm=(state.admins||[]).find(x=>x.id===o.ownerAdminId);
    if(adm&&adm.spaceId){ o.spaceId=adm.spaceId; changed=true; }
    else if(fallbackSpace){ o.spaceId=fallbackSpace; changed=true; }
  });
  if(ensureFleetPerSpaces()) changed=true;
  if(migrateRemoveAutoSeedVehicles()) changed=true;
  if(migrateAdminSkipDriverMirror()) changed=true;
  if(migratePurgeCrossTenantGhostDrivers()) changed=true;
  if(migrateStripSpuriousOwnRoles()) changed=true;
  return changed;
}
function isValidInn(inn){
  const s=String(inn||'').replace(/\D/g,'');
  if(s.length===10){
    const n=s.split('').map(Number);
    const c=((2*n[0]+4*n[1]+10*n[2]+3*n[3]+5*n[4]+9*n[5]+4*n[6]+6*n[7]+8*n[8])%11)%10;
    return c===n[9];
  }
  if(s.length===12){
    const n=s.split('').map(Number);
    const c1=((7*n[0]+2*n[1]+4*n[2]+10*n[3]+3*n[4]+5*n[5]+9*n[6]+4*n[7]+6*n[8]+8*n[9])%11)%10;
    const c2=((3*n[0]+7*n[1]+2*n[2]+4*n[3]+10*n[4]+3*n[5]+5*n[6]+9*n[7]+4*n[8]+6*n[9]+8*n[10])%11)%10;
    return c1===n[10] && c2===n[11];
  }
  return false;
}
async function lookupPartyByInnDaData(inn, token){
  const clean=String(inn||'').replace(/\D/g,'');
  const res=await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party',{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Accept':'application/json',
      'Authorization':'Token '+token
    },
    body:JSON.stringify({query:clean})
  });
  if(!res.ok) throw new Error('DaData: ошибка '+res.status);
  const data=await res.json();
  const s=(data.suggestions&&data.suggestions[0])||null;
  if(!s||!s.data) throw new Error('По ИНН ничего не найдено (DaData)');
  const d=s.data;
  return {
    name:s.value||d.name?.short_with_opf||d.name?.full_with_opf||'',
    inn:d.inn||clean,
    ogrn:d.ogrn||'',
    kpp:d.kpp||'',
    address:(d.address&& (d.address.value||d.address.unrestricted_value))||'',
    director:(d.management&&d.management.name)|| (d.fio? [d.fio.surname,d.fio.name,d.fio.patronymic].filter(Boolean).join(' '):'')
  };
}
function egrulNalogBase(){
  const h=(location.hostname||'').toLowerCase();
  if(isArmadaProdHost(h)||h==='localhost'||h==='127.0.0.1')
    return location.origin.replace(/\/$/,'')+'/egrul-api';
  return ARMADA_LIVE_ORIGIN+'/egrul-api';
}
function parseEgrulDirectorField(g){
  const s=String(g||'').trim();
  if(!s) return '';
  const m=s.match(/:\s*(.+)$/);
  return m?m[1].trim():s;
}
async function lookupPartyByInnEgrul(inn){
  const clean=String(inn||'').replace(/\D/g,'');
  const base=egrulNalogBase();
  const body=new URLSearchParams({
    vyp3CaptchaToken:'', page:'', query:clean, region:'', PreventChromeAutocomplete:''
  });
  const postRes=await fetch(`${base}/`, {
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:body.toString()
  });
  if(!postRes.ok) throw new Error('ФНС ЕГРЮЛ: ошибка '+postRes.status);
  const postData=await postRes.json();
  if(postData.captchaRequired) throw new Error('ФНС: нужна капча на egrul.nalog.ru — попробуйте позже');
  if(!postData.t) throw new Error('ФНС ЕГРЮЛ: пустой ответ');
  await new Promise(r=>setTimeout(r, 2500));
  const res=await fetch(`${base}/search-result/${encodeURIComponent(postData.t)}`);
  if(!res.ok) throw new Error('ФНС ЕГРЮЛ: ошибка '+res.status);
  const data=await res.json();
  const row=(data.rows&&data.rows[0])||null;
  if(!row) throw new Error('По ИНН ничего не найдено в ЕГРЮЛ');
  const isIp=row.k==='ip';
  const director=isIp?(row.n||row.c||''):parseEgrulDirectorField(row.g);
  const name=row.c||row.n||'';
  return {
    name:isIp && name && !/^ИП\s/i.test(name)?'ИП '+name:name,
    inn:row.i||clean,
    ogrn:row.o||'',
    kpp:row.p||'',
    address:row.rn?String(row.rn).replace(/^Г\.\s*/,''):'',
    director
  };
}
function pickApiFnsAddress(addr){
  if(!addr) return '';
  if(typeof addr==='string') return addr.trim();
  if(addr.АдресПолн && typeof addr.АдресПолн==='string') return addr.АдресПолн.trim();
  const parts=[];
  const push=v=>{ if(v&&String(v).trim()) parts.push(String(v).trim()); };
  if(addr.АдресПолнФИАС && typeof addr.АдресПолнФИАС==='object'){
    Object.values(addr.АдресПолнФИАС).forEach(push);
  }
  if(addr.АдресДетали && typeof addr.АдресДетали==='object'){
    ['Регион','Город','Район','НаселПункт','Улица'].forEach(k=>{
      const x=addr.АдресДетали[k];
      if(x&&typeof x==='object'&&x.Наим) push(x.Наим);
      else push(x);
    });
    push(addr.АдресДетали.Дом);
    push(addr.АдресДетали.Корпус);
    push(addr.АдресДетали.Кварт);
  }
  return parts.join(', ');
}
async function lookupPartyByInnApiFns(inn, key){
  const clean=String(inn||'').replace(/\D/g,'');
  const url=`https://api-fns.ru/api/egr?req=${encodeURIComponent(clean)}&key=${encodeURIComponent(key)}`;
  const res=await fetch(url);
  const text=await res.text();
  if(!res.ok) throw new Error('API-ФНС: '+text.slice(0,160));
  let data;
  try{ data=JSON.parse(text); }catch(_){ throw new Error('API-ФНС: неверный ответ'); }
  if(data.error) throw new Error(String(data.error));
  const item=(data.items&&data.items[0])||null;
  if(!item) throw new Error('По ИНН ничего не найдено (API-ФНС)');
  if(item.ЮЛ){
    const ul=item.ЮЛ;
    return {
      name:ul.НаимСокрЮЛ||ul.НаимПолнЮЛ||'',
      inn:ul.ИНН||clean,
      ogrn:ul.ОГРН||'',
      kpp:ul.КПП||'',
      address:pickApiFnsAddress(ul.Адрес),
      director:(ul.Руководитель&&ul.Руководитель.ФИОПолн)||''
    };
  }
  if(item.ИП){
    const ip=item.ИП;
    const fio=ip.ФИОПолн||ip.ФИОПолнЗАГС||'';
    return {
      name:fio?('ИП '+fio):'ИП',
      inn:ip.ИННФЛ||clean,
      ogrn:ip.ОГРНИП||'',
      kpp:'',
      address:pickApiFnsAddress(ip.Адрес),
      director:fio
    };
  }
  throw new Error('API-ФНС: неизвестный формат ответа');
}
async function lookupPartyByInn(inn){
  const clean=String(inn||'').replace(/\D/g,'');
  if(!isValidInn(clean)) throw new Error('Некорректный ИНН');
  const fnsKey=String((state.settings&&state.settings.fnsApiKey)||'').trim();
  const dadataToken=String((state.settings&&state.settings.dadataToken)||'').trim();
  if(fnsKey){
    try{ return await lookupPartyByInnApiFns(clean, fnsKey); }
    catch(err){ console.warn('API-ФНС', err); }
  }
  try{ return await lookupPartyByInnEgrul(clean); }
  catch(egrulErr){
    if(dadataToken){
      try{ return await lookupPartyByInnDaData(clean, dadataToken); }
      catch(_){ throw egrulErr; }
    }
    throw egrulErr;
  }
}
function networkSlow(){
  try{
    const c=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
    if(!c) return false;
    if(c.saveData) return true;
    const t=c.effectiveType;
    return t==='slow-2g'||t==='2g'||t==='3g';
  }catch(_){ return false; }
}
function autoSyncIntervalMs(){
  return networkSlow()?AUTO_SYNC_SLOW_MS:AUTO_SYNC_MS;
}
async function fetchWithTimeout(url, options, timeoutMs){
  const ms=timeoutMs||FETCH_TIMEOUT_MS;
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(), ms);
  try{
    return await fetch(url, {...(options||{}), signal:ctrl.signal});
  }finally{ clearTimeout(timer); }
}
function isQuotaExceededError(err){
  if(!err) return false;
  const n=err&&err.name;
  if(n==='QuotaExceededError') return true;
  const code=err&&err.code;
  if(code===22||code===1014) return true;
  const msg=String(err.message||err||'');
  return /quota/i.test(msg);
}
/** Уменьшить снимок для localStorage, не трогая критичные поля смен/заказов. */
function compactPayloadForLocalStorage(payload, opts){
  const level=(opts&&opts.level)||1;
  if(!payload||typeof payload!=='object') return payload;
  const openShiftId=opts&&opts.openShiftId;
  const o=structuredClone(payload);
  if(Array.isArray(o.opsLog)){
    if(level>=3) o.opsLog=[];
    else if(level>=2) o.opsLog=o.opsLog.slice(0,8);
    else if(o.opsLog.length>20) o.opsLog=o.opsLog.slice(0,20);
  }
  if(Array.isArray(o.shifts)){
    o.shifts=o.shifts.map(sh=>{
      if(!sh||typeof sh!=='object') return sh;
      const copy={...sh};
      const isOpen=openShiftId&&copy.id===openShiftId;
      if(!isOpen){
        delete copy.messages;
        delete copy.draft;
        delete copy.uiStep;
        delete copy.orderStep;
      }else if(Array.isArray(copy.messages)&&copy.messages.length>120){
        copy.messages=copy.messages.slice(-120);
      }
      if(level>=2&&Array.isArray(copy.orders)){
        copy.orders=copy.orders.map(ord=>{
          if(!ord||typeof ord!=='object') return ord;
          const c={...ord};
          delete c.messages;
          delete c.chat;
          return c;
        });
      }
      return copy;
    });
    if(level>=2&&o.shifts.length>50){
      const sorted=[...o.shifts].sort((a,b)=>new Date(b.startedAt||0)-new Date(a.startedAt||0));
      const keep=new Set(sorted.slice(0,50).map(s=>s&&s.id).filter(Boolean));
      if(openShiftId) keep.add(openShiftId);
      o.shifts=o.shifts.filter(s=>s&&keep.has(s.id));
    }
  }
  if(level>=3){
    if(Array.isArray(o.customerPortalLeads)&&o.customerPortalLeads.length>25){
      o.customerPortalLeads=o.customerPortalLeads.slice(-25);
    }
    delete o.adminPresence;
  }
  return o;
}
function armadaLocalCacheActive(){
  try{
    if(typeof window!=='undefined'&&window.ARMADA_LEGACY_FULL_LOCAL_STATE) return false;
    if(typeof localStorage!=='undefined'&&localStorage.getItem('armada_legacy_full_local_state')==='1') return false;
  }catch(_){}
  return true;
}
/** spaceId водителя/собственника для узкого localStorage-кэша (без app.js на /v/). */
function driverSessionScopeSpaceId(){
  try{
    const tok=typeof armadaApiToken==='function'?armadaApiToken():'';
    const p=tok&&typeof decodeArmadaJwtPayload==='function'?decodeArmadaJwtPayload(tok):null;
    if(p){
      const role=String(p.role||'').trim();
      if((role==='driver'||role==='owner_driver')&&p.spaceId) return p.spaceId;
      if(role==='owner_driver'&&typeof ownerDriverRecordFromJwtClaims==='function'){
        const od=ownerDriverRecordFromJwtClaims();
        if(od&&od.spaceId) return od.spaceId;
      }
      if(p.companyId&&typeof spaceIdForDriverCompany==='function'){
        const sid=spaceIdForDriverCompany(p.companyId);
        if(sid) return sid;
      }
    }
  }catch(_){}
  try{
    if(typeof ownerDriverTrustedSpaceId==='function'){
      const sid=ownerDriverTrustedSpaceId();
      if(sid) return sid;
    }
  }catch(_){}
  try{
    const cid=typeof DRIVER_COMPANY_ID!=='undefined'?DRIVER_COMPANY_ID:null;
    if(cid&&typeof spaceIdForDriverCompany==='function'){
      const sid=spaceIdForDriverCompany(cid);
      if(sid) return sid;
    }
    if(typeof DRIVER!=='undefined'&&DRIVER){
      const list=state.drivers||[];
      let d=cid?list.find(x=>x&&samePersonName(x.name,DRIVER)&&x.companyId===cid):null;
      if(!d) d=list.find(x=>x&&samePersonName(x.name,DRIVER));
      if(d&&d.spaceId) return d.spaceId;
    }
  }catch(_){}
  return null;
}
function localCacheScopeSpaceIds(){
  const ids=new Set();
  try{
    const jwtSid=decodeArmadaJwtPayload(armadaApiToken());
    if(jwtSid&&jwtSid.spaceId) ids.add(jwtSid.spaceId);
  }catch(_){}
  try{
    if(typeof currentAdmin!=='undefined'&&currentAdmin&&currentAdmin.spaceId) ids.add(currentAdmin.spaceId);
    if(typeof currentAdmin!=='undefined'&&currentAdmin&&currentAdmin.isSuper){
      (state.spaces||[]).forEach(s=>{ if(s&&s.id) ids.add(s.id); });
    }
  }catch(_){}
  try{
    const dSid=driverSessionScopeSpaceId();
    if(dSid) ids.add(dSid);
  }catch(_){}
  if(state.shift&&state.shift.spaceId) ids.add(state.shift.spaceId);
  return ids;
}
function stripSecretsFromLocalPayload(p){
  if(!p||typeof p!=='object') return p;
  const out=structuredClone(p);
  (out.admins||[]).forEach(a=>{ if(a) delete a.pin; });
  (out.drivers||[]).forEach(d=>{ if(d) delete d.pin; });
  if(out.settings&&typeof out.settings==='object'){
    const s={...out.settings};
    ['dadataToken','fnsToken','yandexMapsKey','smsApiKey','maxBotToken'].forEach(k=>{ if(s[k]) s[k]=''; });
    out.settings=s;
  }
  delete out.tenantMeta;
  return out;
}
function scopedLocalCacheSnapshot(){
  const full=snapshot();
  if(!armadaLocalCacheActive()) return full;
  const scopeIds=localCacheScopeSpaceIds();
  const scoped=stripSecretsFromLocalPayload(full);
  scoped.cacheVersion=1;
  scoped.cacheScope=[...scopeIds];
  if(scopeIds.size){
    const inScopeSid=(id)=>!!(id&&scopeIds.has(id));
    scoped.orders=(scoped.orders||[]).filter(o=>inScopeSid(o&&o.spaceId)||inScopeSid(o&&o.partnerSpaceId));
    scoped.shifts=(scoped.shifts||[]).filter(s=>inScopeSid(s&&s.spaceId));
    scoped.vehicles=(scoped.vehicles||[]).filter(v=>inScopeSid(v&&v.spaceId));
    scoped.drivers=(scoped.drivers||[]).filter(d=>inScopeSid(d&&d.spaceId));
    scoped.companies=(scoped.companies||[]).filter(c=>inScopeSid(c&&c.spaceId));
    scoped.contracts=(scoped.contracts||[]).filter(c=>inScopeSid(c&&c.spaceId));
    scoped.invoices=(scoped.invoices||[]).filter(i=>inScopeSid(i&&i.spaceId));
    if(scoped.docTemplates&&scoped.docTemplates.spaces){
      const sp={};
      scopeIds.forEach(sid=>{ if(scoped.docTemplates.spaces[sid]) sp[sid]=scoped.docTemplates.spaces[sid]; });
      scoped.docTemplates=Object.assign({}, scoped.docTemplates, { spaces:sp });
    }
    if(scoped.epdBySpace){
      const ep={};
      scopeIds.forEach(sid=>{ if(scoped.epdBySpace[sid]) ep[sid]=scoped.epdBySpace[sid]; });
      scoped.epdBySpace=ep;
    }
    if(!(typeof currentAdmin!=='undefined'&&currentAdmin&&currentAdmin.isSuper)){
      scoped.spaces=(scoped.spaces||[]).filter(s=>inScopeSid(s&&s.id));
      scoped.admins=(scoped.admins||[]).filter(a=>inScopeSid(a&&a.spaceId));
      delete scoped.settings;
      delete scoped.finance;
      delete scoped.opsLog;
      delete scoped.marketingMax;
      delete scoped.marketingSocial;
    }
  }
  return scoped;
}
function writeLocalStorageSnapshot(){
  if(armadaLocalCacheActive()){
    armadaLocalStorageSetJson(LOCAL_CACHE_KEY, ()=>scopedLocalCacheSnapshot());
    try{ localStorage.removeItem(KEY); localStorage.removeItem(OLD_KEY); }catch(_){}
  }else{
    writeLocalStorageSnapshot();
  }
}
/** Запись JSON в localStorage с уплотнением при QuotaExceeded. */
function armadaLocalStorageSetJson(key, valueOrFactory){
  const build=typeof valueOrFactory==='function'?valueOrFactory:()=>valueOrFactory;
  let compactLevel=0;
  for(let attempt=0; attempt<5; attempt++){
    let data=build();
    if(compactLevel>0) data=compactPayloadForLocalStorage(data, {openShiftId:state.shift&&state.shift.id, level:compactLevel});
    const json=JSON.stringify(data);
    try{
      localStorage.setItem(key, json);
      if(compactLevel>0) console.warn('localStorage compact level', compactLevel, 'key', key);
      return {ok:true, compactLevel};
    }catch(err){
      if(!isQuotaExceededError(err)||attempt>=4){
        console.warn('localStorage set failed', key, err);
        return {ok:false, compactLevel, err};
      }
      compactLevel++;
      if(compactLevel===1){
        try{ localStorage.removeItem(OLD_KEY); }catch(_){}
      }
    }
  }
  return {ok:false, compactLevel};
}
function persistLocalOnly(){
  try{
    writeLocalStorageSnapshot();
    if(currentAdmin) saveAdminSession();
    if(typeof armadaSyncBroadcast==='function') armadaSyncBroadcast('local_save');
  }catch(err){ console.warn('local persist', err); }
}
/** Сброс отложенного PATCH /state (чтобы не затереть PATCH /admin/orders после отмены). */
function abortQueuedStatePush(){
  clearTimeout(persistTimer);
  persistTimer=null;
  syncPushQueued=false;
}
function isPushServerStateSuccess(res){
  if(!res||typeof res!=='object') return false;
  if(res.ok===true) return true;
  if(res.syncReadOnly===true) return true;
  if(res.customerOrderSync===true) return true;
  if(res.merged===true) return true;
  if(res.aborted===true) return false;
  if(res.ok===false) return false;
  if(res.ignoredAuthFields&&res.ignoredAuthFields.length) return false;
  if(res.aborted===false) return true;
  return false;
}
function pushServerStateFailureMessage(res, err){
  const base='Не сохранилось на сервере, повторим автоматически';
  const tail=err&&err.message
    ?String(err.message)
    :(res&&(res.reason||res.err||res.message)?String(res.reason||res.err||res.message):'');
  return tail?`${base}: ${tail}`:base;
}
function assertPushServerStateSuccess(res){
  if(res&&res.ignoredAuthFields&&res.ignoredAuthFields.length){
    const e=new Error(res.message||'ignored_auth_fields');
    e.ignoredAuthFields=res.ignoredAuthFields;
    throw e;
  }
  if(!isPushServerStateSuccess(res)){
    const e=new Error(pushServerStateFailureMessage(res));
    if(res&&res.reason) e.pushReason=res.reason;
    throw e;
  }
  return res;
}
function pushServerStateQueued(){
  if(syncPushInFlight){
    syncPushQueued=true;
    return syncPushInFlight;
  }
  syncPushInFlight=pushServerState()
    .then(res=>assertPushServerStateSuccess(res))
    .finally(()=>{
      syncPushInFlight=null;
      if(syncPushQueued){
        syncPushQueued=false;
        pushServerStateQueued();
      }
    });
  return syncPushInFlight;
}
let armadaApiTokenStorageMigrated=false;
function migrateArmadaApiTokenStorage(){
  if(armadaApiTokenStorageMigrated) return;
  armadaApiTokenStorageMigrated=true;
  try{
    const legacy=localStorage.getItem(ARMADA_API_TOKEN_KEY)||'';
    if(!legacy) return;
    const role=String((decodeArmadaJwtPayload(legacy)||{}).role||'').trim();
    if(role==='sync'){
      if(!localStorage.getItem(ARMADA_API_SYNC_TOKEN_KEY)) localStorage.setItem(ARMADA_API_SYNC_TOKEN_KEY, legacy);
    }else if(role){
      if(!localStorage.getItem(ARMADA_API_ROLE_TOKEN_KEY)) localStorage.setItem(ARMADA_API_ROLE_TOKEN_KEY, legacy);
    }
    localStorage.removeItem(ARMADA_API_TOKEN_KEY);
  }catch(_){}
}
function armadaApiRoleToken(){
  migrateArmadaApiTokenStorage();
  try{ return localStorage.getItem(ARMADA_API_ROLE_TOKEN_KEY)||''; }catch(_){ return ''; }
}
function armadaJwtAdminPrincipal(p){
  if(!p||String(p.role||'').trim()!=='admin') return null;
  return {
    adminId:String(p.adminId||p.sub||'').trim(),
    isSuper:!!p.isSuper,
  };
}
/** JWT admin должен совпадать с currentAdmin — иначе GET /state отдаёт чужой кабинет. */
function armadaAdminJwtMatchesSession(){
  try{
    if(typeof currentAdmin==='undefined'||!currentAdmin||!currentAdmin.id) return true;
    const t=armadaApiRoleToken();
    if(!t||armadaApiTokenExpiredOrSoon(t)) return false;
    const pr=armadaJwtAdminPrincipal(decodeArmadaJwtPayload(t));
    if(!pr||!pr.adminId) return true;
    if(pr.adminId!==currentAdmin.id) return false;
    if(!!currentAdmin.isSuper!==!!pr.isSuper) return false;
    return true;
  }catch(_){ return true; }
}
function armadaAdminCabinetSessionActive(){
  try{
    if(typeof currentAdmin!=='undefined'&&currentAdmin&&currentAdmin.id) return true;
    if(typeof document!=='undefined'&&document.querySelector&&document.querySelector('#admin.show')) return true;
  }catch(_){}
  return false;
}
function setArmadaApiRoleToken(token){
  migrateArmadaApiTokenStorage();
  try{
    const prev=armadaApiRoleToken();
    if(token){
      const prevA=armadaJwtAdminPrincipal(decodeArmadaJwtPayload(prev));
      const nextA=armadaJwtAdminPrincipal(decodeArmadaJwtPayload(token));
      if(prevA&&nextA&&(prevA.adminId!==nextA.adminId||prevA.isSuper!==nextA.isSuper)) armadaStateEtagClear();
      localStorage.setItem(ARMADA_API_ROLE_TOKEN_KEY, token);
    }else{
      localStorage.removeItem(ARMADA_API_ROLE_TOKEN_KEY);
      armadaStateEtagClear();
    }
  }catch(_){}
}
function armadaApiSyncToken(){
  migrateArmadaApiTokenStorage();
  try{ return localStorage.getItem(ARMADA_API_SYNC_TOKEN_KEY)||''; }catch(_){ return ''; }
}
function setArmadaApiSyncToken(token){
  migrateArmadaApiTokenStorage();
  try{
    if(token) localStorage.setItem(ARMADA_API_SYNC_TOKEN_KEY, token);
    else localStorage.removeItem(ARMADA_API_SYNC_TOKEN_KEY);
  }catch(_){}
}
function armadaApiRoleTokenRole(){
  const t=armadaApiRoleToken();
  if(!t||armadaApiTokenExpiredOrSoon(t)) return '';
  const p=decodeArmadaJwtPayload(t);
  return p&&String(p.role||'').trim()||'';
}
function armadaApiRoleTokenUsable(){
  const t=armadaApiRoleToken();
  return !!t&&!armadaApiTokenExpiredOrSoon(t);
}
function armadaApiSyncTokenUsable(){
  const t=armadaApiSyncToken();
  return !!t&&!armadaApiTokenExpiredOrSoon(t);
}
/** Bearer для API: JWT роли (запись), иначе sync (только чтение). */
function armadaApiToken(){
  migrateArmadaApiTokenStorage();
  const roleTok=armadaApiRoleToken();
  const roleUsable=roleTok&&!armadaApiTokenExpiredOrSoon(roleTok);
  const adminCab=armadaAdminCabinetSessionActive();
  if(roleUsable){
    if(!adminCab||armadaAdminJwtMatchesSession()) return roleTok;
  }
  if(adminCab) return '';
  const syncTok=armadaApiSyncToken();
  if(syncTok&&!armadaApiTokenExpiredOrSoon(syncTok)) return syncTok;
  return roleTok||syncTok||'';
}
function setArmadaApiToken(token){
  migrateArmadaApiTokenStorage();
  if(!token){
    setArmadaApiRoleToken('');
    armadaStateEtagClear();
    return;
  }
  const role=String((decodeArmadaJwtPayload(token)||{}).role||'').trim();
  if(role==='sync') setArmadaApiSyncToken(token);
  else setArmadaApiRoleToken(token);
}
function armadaApiJsonHeaders(){
  const h={ Accept:'application/json', 'Content-Type':'application/json' };
  const t=armadaApiToken();
  if(t) h.Authorization='Bearer '+t;
  return h;
}
/** PATCH /state и прочая запись — только JWT роли (не sync). */
function armadaApiJsonHeadersForWrite(){
  const h={ Accept:'application/json', 'Content-Type':'application/json' };
  const t=armadaApiRoleToken();
  if(t&&!armadaApiTokenExpiredOrSoon(t)) h.Authorization='Bearer '+t;
  else{
    const fallback=armadaApiToken();
    if(fallback) h.Authorization='Bearer '+fallback;
  }
  return h;
}
/** Последние pin/meta для однократного перелогина после 401 (без проверки подписи JWT). */
let armadaApiAuthRetryOpts={ pin:'sync', meta:{ role:'sync' } };
function rememberArmadaApiAuthOpts(opts){
  const o=opts||{};
  if(o.pin!=null) armadaApiAuthRetryOpts.pin=o.pin;
  if(o.meta!=null) armadaApiAuthRetryOpts.meta=o.meta;
}
function decodeArmadaJwtPayload(token){
  try{
    const parts=String(token||'').split('.');
    if(parts.length!==3) return null;
    let b64=parts[1].replace(/-/g,'+').replace(/_/g,'/');
    const pad=b64.length%4;
    if(pad) b64+='='.repeat(4-pad);
    if(typeof atob!=='function') return null;
    const json=atob(b64);
    return JSON.parse(json);
  }catch(_){ return null; }
}
function armadaApiTokenExpiredOrSoon(token, skewSec){
  const sk=skewSec==null?60:Number(skewSec)||0;
  const p=decodeArmadaJwtPayload(token);
  if(!p||p.exp==null) return false;
  const now=Math.floor(Date.now()/1000);
  return now>=(Number(p.exp)-sk);
}
function armadaApiTokenUsable(){
  const t=armadaApiToken();
  if(!t) return false;
  if(armadaApiTokenExpiredOrSoon(t)) return false;
  return true;
}
function armadaApiTokenRole(){
  const roleFromJwt=armadaApiRoleTokenRole();
  if(roleFromJwt) return roleFromJwt;
  const syncTok=armadaApiSyncToken();
  if(syncTok&&!armadaApiTokenExpiredOrSoon(syncTok)){
    const p=decodeArmadaJwtPayload(syncTok);
    return p&&String(p.role||'').trim()||'';
  }
  return '';
}
function armadaApiOptsWantSync(o){
  if(!o||typeof o!=='object') return false;
  const role=String((o.meta&&o.meta.role)||'').trim();
  if(role==='sync') return true;
  if(String(o.pin||'').trim()==='sync'&&!role) return true;
  return false;
}
/** ФИО водителя: driver.js пишет globalThis.DRIVER, в store.js — отдельный let DRIVER. */
function armadaDriverSessionName(){
  try{
    const g=typeof globalThis!=='undefined'?globalThis:(typeof window!=='undefined'?window:null);
    const fromGlobal=g&&String(g.DRIVER||'').trim();
    if(fromGlobal) return fromGlobal;
    if(typeof DRIVER!=='undefined'&&String(DRIVER||'').trim()) return String(DRIVER).trim();
  }catch(_){}
  return '';
}
/** Водительский кабинет: PATCH /state недоступен с sync-токеном. */
function armadaDriverWriteSessionActive(){
  if(armadaDriverSessionName()) return true;
  if(state.shift&&!state.shift.endedAt) return true;
  try{
    if(typeof document!=='undefined'&&document.querySelector&&document.querySelector('#driver.show')) return true;
  }catch(_){}
  return false;
}
function armadaApiKeepDriverTokenOverSync(opts){
  if(!armadaApiOptsWantSync(opts||{})) return false;
  return armadaApiPreserveDriverJwtInCabinet();
}
/** JWT водителя/админа в кабинете /v — не сбрасывать на sync (push ЕТО, 401-retry). */
function armadaApiPreserveDriverJwtInCabinet(){
  if(!armadaDriverWriteSessionActive()) return false;
  if(!armadaApiRoleTokenUsable()) return false;
  const role=armadaApiRoleTokenRole();
  return role==='driver'||role==='admin'||role==='owner_driver';
}
/** Ответ GET /state по sync-токену (каталог входа, без orders/shifts). */
function armadaRemotePayloadIsLoginBootstrap(p){
  if(!p||typeof p!=='object') return false;
  if(Object.prototype.hasOwnProperty.call(p,'orders')) return false;
  if(Array.isArray(p.shifts)&&p.shifts.length) return false;
  if(p.finance!=null) return false;
  return true;
}
function armadaInitAuthorization(init){
  const prev=(init&&init.headers)||{};
  if(typeof prev.get==='function') return String(prev.get('Authorization')||prev.get('authorization')||'');
  return String(prev.Authorization||prev.authorization||'');
}
function armadaBearerUsesToken(bearer, token){
  if(!bearer||!token) return false;
  const t=String(token).trim();
  const b=String(bearer).trim();
  return b===`Bearer ${t}`||b.endsWith(t);
}
/** Запрос к API_BASE с однократным перелогином при 401. */
async function fetchArmadaApi(path, init, timeoutMs, _did401Retry){
  if(!API_BASE) throw new Error('API не настроен');
  const url=path.startsWith('http')?path:`${API_BASE}${path.startsWith('/')?path:'/'+path}`;
  const res=await fetchWithTimeout(url, init, timeoutMs);
  if(res.status!==401||_did401Retry) return res;
  const bearer=armadaInitAuthorization(init);
  const roleTok=armadaApiRoleToken();
  const role=armadaApiRoleTokenRole();
  const method=String((init&&init.method)||'GET').toUpperCase();
  if(method==='PATCH'&&roleTok&&role==='driver'&&armadaBearerUsesToken(bearer, roleTok)){
    setArmadaApiRoleToken('');
    try{
      if(typeof clearDriverSession==='function') clearDriverSession();
      if(typeof show==='function') show('driver-login');
    }catch(_){}
    return res;
  }
  if(armadaApiPreserveDriverJwtInCabinet()) return res;
  if(armadaApiRoleTokenUsable()){
    const rr=armadaApiRoleTokenRole();
    if(rr==='driver'||rr==='admin') return res;
  }
  setArmadaApiSyncToken('');
  const ro=armadaApiAuthRetryOpts||{ pin:'sync', meta:{ role:'sync' } };
  const ok=await ensureArmadaApiToken({ pin:ro.pin||'sync', meta:ro.meta||{ role:'sync' } });
  if(!ok) return res;
  const h=armadaApiJsonHeaders();
  const prev=(init&&init.headers)||{};
  if(prev['Content-Type']) h['Content-Type']=prev['Content-Type'];
  if(prev.Accept) h.Accept=prev.Accept;
  const init2={ ...init, headers:h };
  return fetchWithTimeout(url, init2, timeoutMs);
}
/** При входе: spaces/companies/drivers с сервера — иначе на чистом браузере нет каталога. */
function mergeDriversFromRemoteForLogin(remoteDrivers){
  if(!Array.isArray(remoteDrivers)||!remoteDrivers.length) return false;
  const key=d=>`${String(d.name||'').trim().toLowerCase()}|${d.companyId||''}`;
  const byKey=new Map();
  (state.drivers||[]).forEach(d=>{
    if(!d||!String(d.name||'').trim()) return;
    byKey.set(key(d), {...d});
  });
  remoteDrivers.forEach(r=>{
    if(!r||!String(r.name||'').trim()) return;
    const k=key(r);
    const prev=byKey.get(k)||{};
    byKey.set(k, {...prev, ...r, name:String(r.name||prev.name||'').trim()});
  });
  state.drivers=[...byKey.values()];
  if(typeof migrateDriverPins==='function') migrateDriverPins();
  return true;
}
function mergeLoginCatalogFromRemote(p){
  if(!p||typeof p!=='object') return;
  if(Array.isArray(p.spaces)&&p.spaces.length) state.spaces=p.spaces;
  if(Array.isArray(p.companies)&&p.companies.length) state.companies=p.companies;
  mergeDriversFromRemoteForLogin(p.drivers);
}
async function syncDriversCatalogForLogin(showProgress){
  if(typeof showProgress==='function') showProgress('Загрузка данных…');
  if(typeof initCloudSync==='function'){
    try{ await initCloudSync(); return true; }catch(_){}
  }
  if(navigator.onLine!==false && typeof refreshAuthFromServer==='function'){
    return await refreshAuthFromServer({pin:'sync', meta:{role:'driver'}});
  }
  return false;
}
let refreshAdminListForLoginInflight=null;
const REFRESH_ADMIN_LOGIN_LIST_TIMEOUT_MS=10000;
async function refreshAdminListForLogin(){
  if(!refreshAdminListForLoginInflight){
    refreshAdminListForLoginInflight=refreshAuthFromServer({
      pin:'sync',
      meta:{role:'admin', purpose:'login-list'},
      timeoutMs:REFRESH_ADMIN_LOGIN_LIST_TIMEOUT_MS,
    }).catch(()=>false).finally(()=>{ refreshAdminListForLoginInflight=null; });
  }
  await refreshAdminListForLoginInflight;
  return true;
}
async function refreshAuthFromServer(opts){
  if(navigator.onLine===false || typeof fetchServerState!=='function') return false;
  const o=opts&&typeof opts==='object'?opts:{pin:'sync', meta:{role:'sync'}};
  const timeoutMs=o.timeoutMs!=null?Number(o.timeoutMs):3500;
  const fetchOpts={pin:o.pin||'sync', meta:o.meta||{role:'sync'}};
  try{
    const rec=await fetchServerState(timeoutMs, fetchOpts);
    if(!rec) return false;
    if(rec.unchanged) return armadaLocalStateHasData();
    if(!rec.payload) return false;
    pbRecordId=rec.id;
    mergeLoginCatalogFromRemote(rec.payload);
    if(typeof mergeAdminAuthFromRemote==='function'){
      mergeAdminAuthFromRemote(rec.payload, {remoteWinsAuth:true});
    }
    if(typeof migrateSpaces==='function') migrateSpaces();
    if(typeof migrateDriverPins==='function') migrateDriverPins();
    if(typeof migrateAdmins==='function') migrateAdmins();
    persistLocalOnly();
    return true;
  }catch(_){
    return false;
  }
}
async function ensureArmadaApiToken(opts){
  if(!API_BASE) return false;
  const o=opts||{};
  const wantSync=armadaApiOptsWantSync(o);
  if(armadaApiKeepDriverTokenOverSync(o)) return true;
  if(armadaApiPreserveDriverJwtInCabinet()) return true;
  rememberArmadaApiAuthOpts(o);
  if(wantSync){
    if(armadaApiSyncTokenUsable()) return true;
    setArmadaApiSyncToken('');
    if(typeof armadaApiLogin!=='function') return false;
    const token=await armadaApiLogin(o.pin||'sync', o.meta||{role:'sync'});
    return !!token;
  }
  if(armadaApiRoleTokenUsable()){
    const rr=armadaApiRoleTokenRole();
    if(rr&&rr!=='sync'){
      if(armadaAdminCabinetSessionActive()&&!armadaAdminJwtMatchesSession()){
        setArmadaApiRoleToken('');
        armadaStateEtagClear();
      }else return true;
    }
  }
  const portalWrite=armadaCustomerPortalActive()
    ||(function(){ try{ return typeof currentCustomer!=='undefined'&&currentCustomer; }catch(_){ return false; } })();
  if(portalWrite && typeof ensureCustomerPortalApiToken==='function'){
    const custOk=await ensureCustomerPortalApiToken();
    if(custOk) return true;
    if(armadaApiTokenRole()==='customer') return true;
    return false;
  }
  if(armadaAdminCabinetSessionActive()) return false;
  if(armadaApiSyncTokenUsable()) return true;
  setArmadaApiSyncToken('');
  if(typeof armadaApiLogin!=='function') return false;
  const token=await armadaApiLogin(o.pin||'sync', o.meta||{role:'sync'});
  return !!token;
}
async function armadaApiLogin(pin, meta){
  if(!API_BASE || !pin) return null;
  try{
    const m=meta||{};
    const res=await fetchWithTimeout(`${API_BASE}/auth/login`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', Accept:'application/json' },
      body:JSON.stringify({
        pin,
        role:m.role|| (pin==='sync'?'sync':'admin'),
        adminId:m.id,
        spaceId:m.spaceId
      })
    }, 8000);
    const data=await res.json().catch(()=>({}));
    if(res.ok && data.token){
      const role=String((decodeArmadaJwtPayload(data.token)||{}).role||'').trim()
        ||String(m.role||'').trim()
        ||(pin==='sync'?'sync':'');
      if(role==='sync') setArmadaApiSyncToken(data.token);
      else setArmadaApiRoleToken(data.token);
      return data.token;
    }
  }catch(err){ console.warn('armada-api login', err); }
  return null;
}/** Смена своего PIN админа на сервере (не через PATCH snapshot). */
async function armadaApiChangeAdminPin(oldPin, newPin){
  if(!API_BASE || !oldPin || !newPin) return { ok:false, error:'missing' };
  try{
    await ensureArmadaApiToken({});
    if(armadaApiTokenRole()!=='admin') return { ok:false, error:'not_admin' };
    const res=await fetchArmadaApi('/auth/change-admin-pin', {
      method:'POST',
      headers:armadaApiJsonHeaders(),
      body:JSON.stringify({ oldPin:String(oldPin).trim(), newPin:String(newPin).trim() })
    }, 12000);
    const data=await res.json().catch(()=>({}));
    if(res.status===401) return { ok:false, error:'invalid_old_pin' };
    if(!res.ok) return { ok:false, error:data.error||('http_'+res.status) };
    return { ok:true };
  }catch(err){
    console.warn('armada-api change-admin-pin', err);
    return { ok:false, error:String(err&&err.message||err) };
  }
}
/** Супер: PIN другому admin (не через PATCH snapshot). */
async function armadaApiSetAdminPin(adminId, newPin){
  if(!API_BASE || !adminId || !newPin) return { ok:false, error:'missing' };
  try{
    await ensureArmadaApiToken({});
    if(armadaApiTokenRole()!=='admin') return { ok:false, error:'not_admin' };
    const res=await fetchArmadaApi('/auth/set-admin-pin', {
      method:'POST',
      headers:armadaApiJsonHeaders(),
      body:JSON.stringify({ adminId:String(adminId).trim(), newPin:String(newPin).trim() })
    }, 12000);
    const data=await res.json().catch(()=>({}));
    if(res.status===403) return { ok:false, error:'forbidden' };
    if(!res.ok) return { ok:false, error:data.error||('http_'+res.status) };
    return { ok:true };
  }catch(err){
    console.warn('armada-api set-admin-pin', err);
    return { ok:false, error:String(err&&err.message||err) };
  }
}
let armadaApiVerifyDriverUnsupported=false;
async function armadaApiVerifyDriver(phone, pin, driverId){
  if(!API_BASE || !phone || !pin) return null;
  if(armadaApiVerifyDriverUnsupported) return null;
  try{
    const body={ phone, pin };
    if(driverId) body.driverId=driverId;
    const res=await fetchWithTimeout(`${API_BASE}/auth/verify-driver`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', Accept:'application/json' },
      body:JSON.stringify(body)
    }, 12000);
    if(res.status===404){
      armadaApiVerifyDriverUnsupported=true;
      return null;
    }
    const data=await res.json().catch(()=>({}));
    if(res.ok && data.token){
      setArmadaApiToken(data.token);
      return data;
    }
    if(res.status===409 && Array.isArray(data.drivers)){
      return { __verifyFail:true, status:409, error:'ambiguous', drivers:data.drivers };
    }
    return { __verifyFail:true, status:res.status, error:String(data.error||'').trim() };
  }catch(err){ console.warn('armada-api verify-driver', err); }
  return null;
}
async function armadaApiVerifyOwnerDriver(phone, pin){
  if(!API_BASE || !phone || !pin) return null;
  try{
    const res=await fetchWithTimeout(`${API_BASE}/auth/verify-owner-driver`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', Accept:'application/json' },
      body:JSON.stringify({ phone, pin })
    }, 12000);
    const data=await res.json().catch(()=>({}));
    if(res.ok && data.token){
      if(typeof setArmadaApiRoleToken==='function') setArmadaApiRoleToken(data.token);
      else setArmadaApiToken(data.token);
      return data;
    }
    return { __verifyFail:true, status:res.status, error:String(data.error||'').trim() };
  }catch(err){ console.warn('armada-api verify-owner-driver', err); }
  return null;
}
async function armadaApiVerifyCustomer(phone, pin, scope){
  if(!API_BASE || !phone || !pin) return null;
  try{
    const body={ phone, pin };
    if(scope) body.scope=scope;
    const res=await fetchWithTimeout(`${API_BASE}/auth/verify-customer`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', Accept:'application/json' },
      body:JSON.stringify(body)
    }, 12000);
    const data=await res.json().catch(()=>({}));
    if(res.ok && data.token){
      setArmadaApiToken(data.token);
      return data;
    }
    return {__verifyFail:true, status:res.status, error:String(data.error||data.message||'').trim()};
  }catch(err){ console.warn('armada-api verify-customer', err); }
  return null;
}
/** JWT заказчика для PATCH /state (sync-токен только читает, заявки не сохраняет). */
async function ensureCustomerPortalApiToken(){
  if(!API_BASE || typeof armadaApiVerifyCustomer!=='function') return false;
  if(!armadaCustomerPortalActive()) return false;
  let cust=null;
  try{
    if(typeof currentCustomer!=='undefined' && currentCustomer) cust=currentCustomer;
  }catch(_){}
  if(!cust||!cust.companyId) return false;
  if(armadaApiTokenUsable() && armadaApiTokenRole()==='customer') return true;
  const co=typeof findCompanyById==='function'?findCompanyById(cust.companyId):null;
  if(!co||!co.portalEnabled) return false;
  const phone=typeof formatPhone==='function'?formatPhone(cust.phone||co.portalPhone||''):String(cust.phone||co.portalPhone||'').trim();
  const pin=String(co.portalPin||'').trim();
  if(!phone||pin.length<4) return false;
  const scope=typeof getPortalScope==='function'?getPortalScope():null;
  const verified=await armadaApiVerifyCustomer(phone, pin, scope);
  return !!(verified && verified.token);
}
/** Ручное «Обновить» в портале: true только после успешного чтения state с сервера. */
async function armadaManualServerRefresh(reason, timeoutMs){
  if(navigator.onLine===false) return false;
  if(typeof fetchServerState!=='function') return false;
  try{
    const rec=await fetchServerState(timeoutMs||10000);
    if(rec&&rec.unchanged){ touchSyncServerOk(); return true; }
    if(!rec||!rec.payload) return false;
    pbRecordId=rec.id;
    touchSyncServerOk();
    if(typeof pullRemoteUpdates==='function') await pullRemoteUpdates(reason||'manual-refresh');
    return true;
  }catch(_){
    return false;
  }
}
async function fetchArmadaApiHealth(timeoutMs){
  if(!API_BASE) return null;
  try{
    const res=await fetchWithTimeout(`${API_BASE}/health`, { headers:{ Accept:'application/json' } }, timeoutMs||6000);
    const data=await res.json().catch(()=>null);
    return res.ok&&data?data:null;
  }catch(_){ return null; }
}
const ARMADA_STATE_ETAG_KEY='ARMADA_STATE_ETAG';
function armadaStateEtagGet(){
  try{ return localStorage.getItem(ARMADA_STATE_ETAG_KEY)||''; }catch(_){ return ''; }
}
function armadaStateEtagSet(v){
  try{
    if(v) localStorage.setItem(ARMADA_STATE_ETAG_KEY,String(v));
    else localStorage.removeItem(ARMADA_STATE_ETAG_KEY);
  }catch(_){}
}
function armadaStateEtagClear(){
  armadaStateEtagSet('');
}
function armadaLocalStateHasData(){
  if(!state||typeof state!=='object') return false;
  if(Number(state.dataEpoch)>0) return true;
  return ['spaces','admins','orders','companies','drivers','vehicles','shifts'].some(
    k=>Array.isArray(state[k])&&state[k].length>0
  );
}
function armadaMaySendStateIfNoneMatch(){
  if(typeof armadaAdminIsSuperSession==='function'&&armadaAdminIsSuperSession()) return false;
  if(armadaAdminCabinetSessionActive()&&!armadaAdminJwtMatchesSession()) return false;
  return !!(pbRecordId && armadaLocalStateHasData());
}
function armadaCaptureStateEtagFromResponse(res){
  if(!res||typeof res.headers?.get!=='function') return;
  const etag=res.headers.get('ETag');
  if(etag) armadaStateEtagSet(etag);
}
async function fetchServerStateFromApi(timeoutMs){
  const headers=armadaApiJsonHeaders();
  if(armadaMaySendStateIfNoneMatch()){
    const cachedEtag=armadaStateEtagGet();
    if(cachedEtag) headers['If-None-Match']=cachedEtag;
  }
  const res=await fetchArmadaApi('/state', { headers }, timeoutMs);
  if(res.status===304){
    armadaCaptureStateEtagFromResponse(res);
    touchSyncServerOk();
    return { id:pbRecordId, unchanged:true, viaApi:true };
  }
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error||data.message||'API state '+res.status);
  armadaCaptureStateEtagFromResponse(res);
  const rec=data.record;
  const payload=(rec&&rec.payload!=null)?rec.payload:data.payload;
  const id=(rec&&rec.id!=null)?rec.id:(data.recordId||null);
  if(!payload) return null;
  touchSyncServerOk();
  return { id, payload, viaApi:true };
}
async function fetchServerStateFromPb(timeoutMs){
  const filter=encodeURIComponent("key='main'");
  const res=await fetchWithTimeout(`${PB_BASE}/api/collections/app_state/records?filter=${filter}&perPage=1`, {}, timeoutMs);
  if(!res.ok) throw new Error('Не удалось загрузить базу ('+res.status+')');
  const data=await res.json();
  return (data.items&&data.items[0])||null;
}
function armadaCustomerPortalActive(){
  try{
    if(globalThis.ARMADA_CUSTOMER_PORTAL_ACTIVE) return true;
    if(typeof document!=='undefined' && document.querySelector('#customer-portal.show')) return true;
    const p=(location.pathname||'').toLowerCase();
    if(/\/(z)(\/|$)/.test(p)) return true;
  }catch(_){}
  return false;
}
function armadaPbStateFallbackAllowed(){
  if(typeof window!=='undefined' && window.ARMADA_PUBLIC_ORDER_STANDALONE) return false;
  if(armadaCustomerPortalActive()) return false;
  if(typeof currentCustomer!=='undefined' && currentCustomer) return false;
  return true;
}
function armadaBackgroundRemoteSyncEnabled(){
  if(typeof window!=='undefined' && window.ARMADA_PUBLIC_ORDER_STANDALONE) return false;
  if(armadaCustomerPortalActive()) return false;
  if(typeof currentCustomer!=='undefined' && currentCustomer) return false;
  return true;
}
/** /z /v /a без восстановленной сессии — не мигрировать localStorage и не sync на сервер. */
function armadaDedicatedGuestNoSession(){
  let urlEntry=typeof dedicatedEntryMode==='function'?dedicatedEntryMode():null;
  if(!urlEntry&&typeof isDedicatedEntryUrl==='function'&&isDedicatedEntryUrl()){
    try{ urlEntry=typeof readEntryFromUrl==='function'?readEntryFromUrl():null; }catch(_){ urlEntry=null; }
  }
  if(!urlEntry){
    try{
      const path=(location.pathname||'').toLowerCase();
      if(/^\/z(?:\/|$)/.test(path)) urlEntry='customer';
      else if(/^\/v(?:\/|$)/.test(path)) urlEntry='driver';
      else if(/^\/a(?:\/|$)/.test(path)) urlEntry='admin';
    }catch(_){}
  }
  if(!urlEntry) return false;
  if(urlEntry==='customer'){
    if(typeof restoreCustomerSession!=='function') return true;
    return !restoreCustomerSession();
  }
  if(urlEntry==='driver'){
    if(typeof restoreDriverSession!=='function') return true;
    return !restoreDriverSession();
  }
  if(urlEntry==='admin'){
    if(typeof canAutoRestoreAdmin!=='function') return true;
    return !canAutoRestoreAdmin();
  }
  return false;
}
function armadaStripOrderComparableVolatile(o){
  if(!o||typeof o!=='object') return o;
  const c=structuredClone(o);
  delete c.updatedAt;
  delete c.customerDriverDocsConfirmPhotosSig;
  if(c.customerDriverDocsConfirm&&typeof c.customerDriverDocsConfirm==='object'){
    const cc={...c.customerDriverDocsConfirm};
    delete cc.at;
    c.customerDriverDocsConfirm=cc;
  }
  if(c.docs&&typeof c.docs==='object'){
    const docs={};
    Object.keys(c.docs).forEach(k=>{
      const d=c.docs[k];
      if(d&&typeof d==='object'){
        const dc={...d};
        delete dc.updatedAt;
        docs[k]=dc;
      }else docs[k]=d;
    });
    c.docs=docs;
  }
  return c;
}
/** Снимок state для сравнения «реально изменилось» (без эпохи и служебных полей). */
function armadaStateComparableSig(){
  const raw=typeof snapshot==='function'?snapshot():{};
  const s=structuredClone(raw);
  delete s.dataEpoch;
  delete s.savedAt;
  delete s.appBuild;
  delete s.adminPresence;
  delete s.opsLog;
  if(Array.isArray(s.orders)) s.orders=s.orders.map(armadaStripOrderComparableVolatile);
  if(Array.isArray(s.shifts)){
    s.shifts=s.shifts.map(sh=>{
      const c=structuredClone(sh);
      delete c.updatedAt;
      if(Array.isArray(c.orders)) c.orders=c.orders.map(armadaStripOrderComparableVolatile);
      return c;
    });
  }
  return JSON.stringify(s);
}
async function fetchServerState(timeoutMs, opts){
  if(API_BASE){
    const authed=await ensureArmadaApiToken(opts);
    try{
      const rec=await fetchServerStateFromApi(timeoutMs);
      if(rec&&rec.unchanged) return rec;
      if(rec&&rec.payload) return rec;
      if(authed&&armadaPbStateFallbackAllowed()) console.warn('API state empty, fallback PB');
    }catch(err){
      const msg=String(err&&err.message||err||'');
      const api401=/\b401\b/.test(msg);
      if(api401){
        console.warn('API state fetch 401 (без PocketBase)', err);
        return null;
      }
      if(authed&&armadaPbStateFallbackAllowed()) console.warn('API state fetch, fallback PB', err);
      else return null;
    }
  }
  if(!armadaPbStateFallbackAllowed()) return null;
  return await fetchServerStateFromPb(timeoutMs);
}
function parseApiStateConflict(data){
  const remotePayload=(data&&(data.payload||(data.record&&data.record.payload)))||null;
  const remoteEpoch=data&&data.remoteEpoch!=null?Number(data.remoteEpoch)
    :(remotePayload?Number(remotePayload.dataEpoch)||0:null);
  const recordId=data&&(data.recordId||(data.record&&data.record.id))||null;
  const stateGuardShrink=!!(data&&data.error==='state_guard_shrink');
  const shrunk=stateGuardShrink&&Array.isArray(data.shrunk)?data.shrunk:[];
  return { remotePayload, remoteEpoch, recordId, stateGuardShrink, shrunk };
}
/** GET /state + слияние: сервер полный, локальные новые/изменённые заказы и смены сохраняются. */
function mergeFullRemotePreservingLocal(remote){
  if(!remote||typeof remote!=='object') return false;
  const localShifts=(state.shifts||[]).map(s=>structuredClone(s));
  const localOrders=(state.orders||[]).map(o=>structuredClone(o));
  applyPayload(remote, {keepShifts:localShifts, keepOrders:localOrders, remoteSeq:true, remoteWinsAuth:true});
  if(typeof healOrphanOrdersIntoShifts==='function') healOrphanOrdersIntoShifts();
  if(typeof migrateEtoFromMessages==='function') migrateEtoFromMessages();
  if(typeof mergeRemoteOrderAssignments==='function') mergeRemoteOrderAssignments(remote);
  if(typeof reconcileOrdersAfterSync==='function') reconcileOrdersAfterSync();
  return true;
}
/** Сообщение пользователю по ignoredAuthFields из PATCH /state. */
function formatIgnoredAuthFieldsUserMessage(ignored){
  if(!ignored||!ignored.length) return '';
  const labels={ phone:'телефон', loginBy:'способ входа', isSuper:'роль супер', pin:'PIN' };
  const parts=[];
  for(const row of ignored){
    const lab=labels[row.field]||row.field;
    if(row.kind==='admin') parts.push(`админ: ${lab}`);
    else if(row.kind==='driver') parts.push(`водитель: ${lab}`);
    else parts.push(lab);
  }
  const uniq=[...new Set(parts)];
  return 'Сервер не принял изменение входа ('+uniq.join(', ')+'). Данные восстановлены с сервера.';
}
function applyIgnoredAuthFieldsRollback(ignored, serverPayload, prevPlainPins){
  if(!ignored||!ignored.length||!serverPayload) return false;
  let changed=false;
  const prevPins=prevPlainPins||{};
  for(const row of ignored){
    if(row.kind==='admin'){
      const sa=(serverPayload.admins||[]).find(a=>a.id===row.id);
      const la=(state.admins||[]).find(a=>a.id===row.id);
      if(!la) continue;
      if(row.field==='phone'){
        if(sa&&sa.phone!==undefined) la.phone=sa.phone;
        else delete la.phone;
        changed=true;
      }else if(row.field==='loginBy'&&sa){
        la.loginBy=sa.loginBy||'inn';
        changed=true;
      }else if(row.field==='isSuper'&&sa){
        la.isSuper=!!sa.isSuper;
        changed=true;
      }else if(row.field==='pin'&&prevPins['admin:'+row.id]!=null){
        la.pin=prevPins['admin:'+row.id];
        changed=true;
      }
    }else if(row.kind==='driver'&&row.field==='pin'){
      const ld=(state.drivers||[]).find(d=>d.id===row.id);
      if(ld&&prevPins['driver:'+row.id]!=null){
        ld.pin=prevPins['driver:'+row.id];
        changed=true;
      }
    }
  }
  if(changed){
    persistLocalOnly();
    if(typeof bumpDataEpoch==='function') bumpDataEpoch('ignored-auth-rollback');
  }
  return changed;
}
function pushResultFromIgnored(ignored, serverPayload, prevPlainPins){
  if(!ignored||!ignored.length) return null;
  applyIgnoredAuthFieldsRollback(ignored, serverPayload, prevPlainPins);
  return {
    ok:false,
    ignoredAuthFields:ignored,
    err:'ignored_auth_fields',
    message:formatIgnoredAuthFieldsUserMessage(ignored),
  };
}
function loadCustomerPortalSyncQueue(){
  try{
    const raw=localStorage.getItem(CUST_PORTAL_SYNC_KEY);
    const q=raw?JSON.parse(raw):[];
    return Array.isArray(q)?q:[];
  }catch(_){ return []; }
}
function saveCustomerPortalSyncQueue(q){
  try{
    localStorage.setItem(CUST_PORTAL_SYNC_KEY, JSON.stringify(q||[]));
  }catch(_){}
}
function customerPortalSyncItemForOrder(orderId){
  const oid=String(orderId||'').trim();
  if(!oid) return null;
  const order=(state.orders||[]).find(o=>o&&o.id===oid);
  if(!order) return null;
  const lead=(state.customerPortalLeads||[]).find(l=>l&&l.orderId===oid)||null;
  return { order:structuredClone(order), lead:lead?structuredClone(lead):null, orderId:oid };
}
function enqueueCustomerPortalSync(orderId){
  const item=customerPortalSyncItemForOrder(orderId);
  if(!item) return false;
  const q=loadCustomerPortalSyncQueue().filter(x=>x&&x.orderId!==item.orderId);
  q.push(item);
  saveCustomerPortalSyncQueue(q);
  return true;
}
function resolveCustomerPortalOrderId(explicitId){
  const oid=String(explicitId||'').trim();
  if(oid) return oid;
  let companyId='';
  try{
    if(typeof currentCustomer!=='undefined'&&currentCustomer) companyId=String(currentCustomer.companyId||'').trim();
  }catch(_){}
  if(!companyId) return '';
  const mine=(state.orders||[]).filter(o=>o&&String(o.customerId||'')===companyId);
  if(!mine.length) return '';
  mine.sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
  return mine[0].id||'';
}
async function postAdminOrderPayload(order, isNew, expectedRev){
  const body={ order };
  if(expectedRev!=null&&!Number.isNaN(Number(expectedRev))) body.expectedRev=Number(expectedRev);
  const path=isNew?'/admin/orders':`/admin/orders/${encodeURIComponent(order.id)}`;
  const method=isNew?'POST':'PATCH';
  const res=await fetchArmadaApi(path, {
    method,
    headers:armadaApiJsonHeaders(),
    body:JSON.stringify(body),
  }, PATCH_TIMEOUT_MS, true);
  const data=await res.json().catch(()=>({}));
  return { res, data };
}
async function applyAdminOrderApiResponse(data){
  if(data&&data.dataEpoch!=null){
    const epoch=Number(data.dataEpoch)||0;
    if(epoch>(Number(state.dataEpoch)||0)) state.dataEpoch=epoch;
  }
  if(data&&data.orderId&&data.rev!=null){
    const rev=Number(data.rev);
    const list=state.orders||(state.orders=[]);
    const i=list.findIndex(o=>o&&o.id===data.orderId);
    if(i>=0) list[i]={...list[i], _entityRev:rev};
  }
  try{
    const mergeRemote=(remote, recordId)=>{
      if(!remote) return false;
      if(recordId) pbRecordId=recordId;
      if(typeof mergeFullRemotePreservingLocal==='function'){
        mergeFullRemotePreservingLocal(remote);
      }else if(typeof applyPayload==='function'){
        const localShifts=(state.shifts||[]).map(s=>structuredClone(s));
        const localOrders=(state.orders||[]).map(o=>structuredClone(o));
        applyPayload(remote, {keepShifts:localShifts, keepOrders:localOrders, remoteSeq:true, remoteWinsAuth:true});
      }else return false;
      persistLocalOnly();
      return true;
    };
    if(data&&data.payload&&mergeRemote(data.payload, data.recordId)){
      touchSyncServerOk();
      return;
    }
    const rec=await fetchServerState(typeof INIT_FETCH_MS!=='undefined'?INIT_FETCH_MS:8000);
    if(rec&&rec.payload){
      mergeRemote(rec.payload, rec.id||pbRecordId);
    }
    touchSyncServerOk();
  }catch(err){
    console.warn('admin order refresh', err);
  }
}
/** Заказ логиста — POST/PATCH /admin/orders (не PATCH всего state). */
async function persistAdminOrderImmediate(orderOrId, opts={}){
  persistLocalOnly();
  if(navigator.onLine===false){
    syncStatus='local';
    if(typeof updateSyncHint==='function') updateSyncHint();
    return { ok:false, offline:true };
  }
  const order=orderOrId&&typeof orderOrId==='object'
    ?orderOrId
    :(state.orders||[]).find(o=>o&&o.id===orderOrId);
  if(!order||!order.id) return { ok:false, err:'no_order' };
  abortQueuedStatePush();
  if(syncPushInFlight){
    try{ await syncPushInFlight; }catch(_){}
  }
  abortQueuedStatePush();
  syncStatus='syncing';
  if(typeof updateSyncHint==='function') updateSyncHint();
  let lastErr=null;
  const isNew=opts.isNew===true;
  for(let attempt=0; attempt<3; attempt++){
    if(attempt>0) await new Promise(r=>setTimeout(r, 800*attempt));
    try{
      await ensureArmadaApiToken({});
      const role=armadaApiTokenRole();
      if(role!=='admin'&&role!=='owner_driver'){
        return { ok:false, err:'not_admin_role', message:'Нужен вход логиста или частного перевозчика' };
      }
      const expectedRev=!isNew&&order._entityRev!=null?Number(order._entityRev):null;
      const { res, data }=await postAdminOrderPayload(order, isNew, expectedRev);
      if(!res.ok){
        if(isNew&&res.status===409&&data&&data.error==='order_already_exists'){
          await applyAdminOrderApiResponse(data);
          abortQueuedStatePush();
          applySyncPushSuccess();
          return { ok:true, alreadyExists:true, dataEpoch:data.dataEpoch };
        }
        if(res.status===409&&data&&data.error==='rev_conflict'&&data.rev!=null){
          order._entityRev=Number(data.rev);
          return {
            ok:false,
            err:'rev_conflict',
            rev:data.rev,
            message:'Заказ изменили на другом устройстве — обновите карточку',
          };
        }
        const msg=data.message||data.error||(`HTTP ${res.status}`);
        return { ok:false, err:data.error||'admin_order_failed', message:String(msg) };
      }
      await applyAdminOrderApiResponse(data);
      if(data.rev!=null) order._entityRev=Number(data.rev);
      markAdminOrderPushed(order);
      abortQueuedStatePush();
      if(typeof relinkShiftOrderRefs==='function') relinkShiftOrderRefs();
      applySyncPushSuccess();
      return { ok:true, dataEpoch:data.dataEpoch };
    }catch(err){
      lastErr=err;
      console.warn('admin order push attempt', attempt+1, err);
    }
  }
  applySyncPushFailure(lastErr, 'admin order push');
  return { ok:false, offline:false, err:lastErr, message:lastErr&&lastErr.message?String(lastErr.message):'Не удалось сохранить заказ на сервере' };
}
async function postCustomerOrderPayload(item){
  const body={
    dataEpoch:Number(state.dataEpoch)||0,
    order:item.order,
  };
  if(item.lead) body.customerPortalLead=item.lead;
  const res=await fetchArmadaApi('/customer/orders', {
    method:'POST',
    headers:armadaApiJsonHeaders(),
    body:JSON.stringify(body),
  }, PATCH_TIMEOUT_MS, true);
  const data=await res.json().catch(()=>({}));
  return { res, data };
}
async function flushCustomerPortalSyncQueue(){
  if(!API_BASE) return { ok:true, flushed:0 };
  if(typeof ensureCustomerPortalApiToken==='function'){
    const custOk=await ensureCustomerPortalApiToken();
    if(!custOk && armadaApiTokenRole()!=='customer'){
      return { ok:false, err:'not_customer_role' };
    }
  }else if(armadaApiTokenRole()!=='customer'){
    return { ok:false, err:'not_customer_role' };
  }
  let q=loadCustomerPortalSyncQueue();
  if(!q.length) return { ok:true, flushed:0 };
  let flushed=0;
  while(q.length){
    const item=q[0];
    if(!item||!item.order){
      q=q.slice(1);
      continue;
    }
    try{
      const { res, data }=await postCustomerOrderPayload(item);
      if(res.status===409){
        const errCode=data&&data.error;
        const idempotentDup=
          errCode==='order_already_exists'||errCode==='duplicate_order';
        if(idempotentDup){
          const orderId=data.orderId||(item.order&&item.order.id)||item.orderId||null;
          await applyAdminOrderApiResponse({...data, orderId});
          touchSyncServerOk();
          q=q.slice(1);
          flushed++;
          saveCustomerPortalSyncQueue(q);
          continue;
        }
        if(data.payload&&typeof applyPayload==='function'){
          applyPayload(data.payload, {remoteSeq:true, remoteWinsAuth:true});
          persistLocalOnly();
        }
        q=q.slice(1);
        flushed++;
        saveCustomerPortalSyncQueue(q);
        continue;
      }
      if(!res.ok) throw new Error(data.error||'customer order '+res.status);
      if(data.dataEpoch!=null && typeof applyPayload==='function'){
        const epoch=Number(data.dataEpoch)||0;
        if(epoch>(Number(state.dataEpoch)||0)) state.dataEpoch=epoch;
      }
      touchSyncServerOk();
      q=q.slice(1);
      flushed++;
      saveCustomerPortalSyncQueue(q);
    }catch(err){
      console.warn('customer portal sync', err);
      saveCustomerPortalSyncQueue(q);
      throw err;
    }
  }
  saveCustomerPortalSyncQueue(q);
  return { ok:true, flushed };
}
function armadaCustomerMustNotPatchState(){
  if(!API_BASE) return false;
  if(armadaApiTokenRole()==='customer') return true;
  if(armadaCustomerPortalActive()) return true;
  try{
    if(typeof currentCustomer!=='undefined'&&currentCustomer) return true;
  }catch(_){}
  return false;
}
/** Откат этапа 2: водитель снова PATCH /state (localStorage armada_driver_legacy_state=1). */
function armadaDriverLegacyStatePush(){
  try{
    if(typeof window!=='undefined'&&window.ARMADA_DRIVER_LEGACY_STATE) return true;
    if(typeof localStorage!=='undefined'&&localStorage.getItem('armada_driver_legacy_state')==='1') return true;
  }catch(_){}
  return false;
}
function armadaDriverMustNotPatchState(){
  if(!API_BASE||armadaDriverLegacyStatePush()) return false;
  return armadaApiTokenRole()==='driver';
}
function shiftCloneForApi(shift){
  const copy=structuredClone(shift);
  delete copy._entityRev;
  return copy;
}
async function postShiftPayload(shift, expectedRev){
  const body={ shift:shiftCloneForApi(shift) };
  if(expectedRev!=null&&!Number.isNaN(Number(expectedRev))) body.expectedRev=Number(expectedRev);
  const res=await fetchArmadaApi('/shifts', {
    method:'POST',
    headers:armadaApiJsonHeaders(),
    body:JSON.stringify(body),
  }, PATCH_TIMEOUT_MS, true);
  const data=await res.json().catch(()=>({}));
  return { res, data };
}
async function patchShiftPayload(shift, expectedRev){
  const body={ shift:shiftCloneForApi(shift) };
  if(expectedRev!=null&&!Number.isNaN(Number(expectedRev))) body.expectedRev=Number(expectedRev);
  const path=`/shifts/${encodeURIComponent(shift.id)}`;
  const res=await fetchArmadaApi(path, {
    method:'PATCH',
    headers:armadaApiJsonHeaders(),
    body:JSON.stringify(body),
  }, PATCH_TIMEOUT_MS, true);
  const data=await res.json().catch(()=>({}));
  return { res, data };
}
async function applyShiftApiResponse(data){
  if(data&&data.dataEpoch!=null){
    const epoch=Number(data.dataEpoch)||0;
    if(epoch>(Number(state.dataEpoch)||0)) state.dataEpoch=epoch;
  }
  if(data&&data.shift&&data.shift.id){
    const rev=Number(data.rev);
    const srv=data.shift;
    const sid=srv.id;
    const withRev={...srv};
    if(rev) withRev._entityRev=rev;
    const i=(state.shifts||[]).findIndex(s=>s&&s.id===sid);
    if(i>=0) state.shifts[i]={...state.shifts[i], ...withRev};
    else state.shifts.unshift(withRev);
    if(state.shift&&state.shift.id===sid) state.shift={...state.shift, ...withRev};
    if(Array.isArray(srv.orders)){
      srv.orders.forEach(o=>{
        if(!o||!o.id) return;
        const oi=(state.orders||[]).findIndex(x=>x&&x.id===o.id);
        if(oi>=0) state.orders[oi]={...state.orders[oi], ...o};
        else state.orders.push(o);
      });
    }
    persistLocalOnly();
  }
  try{
    if(data&&data.payload&&typeof mergeFullRemotePreservingLocal==='function'){
      mergeFullRemotePreservingLocal(data.payload);
      persistLocalOnly();
    }
  }catch(err){
    console.warn('shift api payload merge', err);
  }
  touchSyncServerOk();
}
/** Смена водителя — POST/PATCH /shifts (не PATCH всего state). */
async function persistDriverShiftImmediate(opts={}){
  persistLocalOnly();
  if(navigator.onLine===false){
    syncStatus='local';
    if(typeof updateDriverNetHint==='function') updateDriverNetHint();
    return { ok:false, offline:true };
  }
  let shift=state.shift;
  if((!shift||!shift.id)&&typeof findOpenShift==='function') shift=findOpenShift();
  if(!shift||!shift.id) return { ok:true, skipped:true };
  if(typeof stampShiftOwner==='function') stampShiftOwner(shift, shift.driverName||DRIVER, shift.vehiclePlate);
  if(!shift.spaceId) return { ok:false, err:'no_space_id', message:'Нет кабинета (spaceId) у смены' };
  abortQueuedStatePush();
  if(syncPushInFlight){
    try{ await syncPushInFlight; }catch(_){}
  }
  abortQueuedStatePush();
  syncStatus='syncing';
  if(typeof updateDriverNetHint==='function') updateDriverNetHint();
  let lastErr=null;
  for(let attempt=0; attempt<4; attempt++){
    if(attempt>0) await new Promise(r=>setTimeout(r, 400*attempt));
    try{
      await ensureArmadaApiToken({});
      const shiftRole=armadaApiTokenRole();
      if(shiftRole!=='driver'&&shiftRole!=='owner_driver'){
        return { ok:false, err:'not_driver_role', message:'Нужен вход водителя или частного перевозчика' };
      }
      const expectedRev=shift._entityRev!=null?Number(shift._entityRev):null;
      const hasRev=expectedRev!=null&&!Number.isNaN(expectedRev);
      let res, data;
      if(hasRev){
        ({ res, data }=await patchShiftPayload(shift, expectedRev));
        if(res.status===404) ({ res, data }=await postShiftPayload(shift, null));
      }else{
        ({ res, data }=await postShiftPayload(shift, null));
        if(res.status===409&&data&&data.error==='shift_already_exists'){
          const rev=data.rev!=null?Number(data.rev):null;
          ({ res, data }=await patchShiftPayload(shift, rev));
        }
      }
      if(res.status===409&&data&&data.error==='rev_conflict'&&data.rev!=null){
        shift._entityRev=Number(data.rev);
        if(state.shift&&state.shift.id===shift.id) state.shift._entityRev=shift._entityRev;
        continue;
      }
      if(res.status===503&&data&&data.error==='shifts_entity_disabled'){
        return pushServerState(opts.prevPlainPins, { forceLegacyState:true });
      }
      if(!res.ok){
        const msg=data.message||data.error||(`HTTP ${res.status}`);
        return { ok:false, err:data.error||'shift_failed', message:String(msg) };
      }
      await applyShiftApiResponse(data);
      abortQueuedStatePush();
      applySyncPushSuccess();
      return { ok:true, rev:data.rev, dataEpoch:data.dataEpoch };
    }catch(err){
      lastErr=err;
      console.warn('driver shift push attempt', attempt+1, err);
    }
  }
  applySyncPushFailure(lastErr, 'driver shift push');
  return { ok:false, offline:false, err:lastErr, message:lastErr&&lastErr.message?String(lastErr.message):'Не удалось сохранить смену на сервере' };
}
/** Откат этапа 1–2: заказы/смены логиста снова через PATCH /state. */
function armadaAdminLegacyOrdersShiftsPush(){
  try{
    if(typeof window!=='undefined'&&window.ARMADA_ADMIN_LEGACY_ORDERS_SHIFTS_STATE) return true;
    if(typeof localStorage!=='undefined'&&localStorage.getItem('armada_admin_legacy_orders_shifts_state')==='1') return true;
  }catch(_){}
  return false;
}
function armadaAdminOrdersShiftsApiActive(){
  if(!API_BASE||armadaAdminLegacyOrdersShiftsPush()) return false;
  const role=armadaApiTokenRole();
  return role==='admin'||role==='owner_driver';
}
const armadaOrdersPushedSig=new Map();
const armadaShiftsPushedSig=new Map();
function adminOrderEntitySig(order){
  if(!order||!order.id) return '';
  const copy=structuredClone(order);
  delete copy._entityRev;
  return `${order.id}:${JSON.stringify(copy)}`;
}
function adminShiftEntitySig(shift){
  if(!shift||!shift.id) return '';
  const copy=shiftCloneForApi(shift);
  return `${shift.id}:${JSON.stringify(copy)}`;
}
function adminOrderNeedsPush(order){
  const sig=adminOrderEntitySig(order);
  if(!sig) return false;
  return armadaOrdersPushedSig.get(order.id)!==sig;
}
function adminShiftNeedsPush(shift){
  const sig=adminShiftEntitySig(shift);
  if(!sig) return false;
  return armadaShiftsPushedSig.get(shift.id)!==sig;
}
function markAdminOrderPushed(order){
  const sig=adminOrderEntitySig(order);
  if(sig) armadaOrdersPushedSig.set(order.id, sig);
}
function markAdminShiftPushed(shift){
  const sig=adminShiftEntitySig(shift);
  if(sig) armadaShiftsPushedSig.set(shift.id, sig);
}
async function upsertAdminOrderOnServer(order){
  if(!order||!order.id) return { ok:false, err:'no_order' };
  if(!String(order.spaceId||'').trim()) return { ok:false, err:'no_space_id' };
  const expectedRev=order._entityRev!=null?Number(order._entityRev):null;
  const hasRev=expectedRev!=null&&!Number.isNaN(expectedRev);
  const isNew=!hasRev;
  for(let attempt=0; attempt<4; attempt++){
    if(attempt>0) await new Promise(r=>setTimeout(r, 350*attempt));
    const { res, data }=await postAdminOrderPayload(order, isNew, hasRev?expectedRev:null);
    if(res.status===503&&data&&data.error==='orders_entity_disabled'){
      return { ok:false, fallbackLegacy:true, err:'orders_entity_disabled' };
    }
    if(res.status===409&&data&&data.error==='rev_conflict'&&data.rev!=null){
      order._entityRev=Number(data.rev);
      return {
        ok:false,
        err:'rev_conflict',
        rev:data.rev,
        message:'Заказ изменили на другом устройстве — обновите карточку',
      };
    }
    if(isNew&&res.status===409&&data&&data.error==='order_already_exists'){
      await applyAdminOrderApiResponse(data);
      markAdminOrderPushed(order);
      return { ok:true, alreadyExists:true, dataEpoch:data.dataEpoch };
    }
    if(!res.ok){
      const msg=data.message||data.error||(`HTTP ${res.status}`);
      return { ok:false, err:data.error||'admin_order_failed', message:String(msg) };
    }
    await applyAdminOrderApiResponse(data);
    if(data.rev!=null) order._entityRev=Number(data.rev);
    markAdminOrderPushed(order);
    return { ok:true, dataEpoch:data.dataEpoch, rev:data.rev };
  }
  return { ok:false, err:'admin_order_conflict', message:'Не удалось сохранить заказ' };
}
async function upsertAdminShiftOnServer(shift){
  if(!shift||!shift.id) return { ok:false, err:'no_shift' };
  if(!String(shift.spaceId||'').trim()) return { ok:false, err:'no_space_id' };
  const expectedRev=shift._entityRev!=null?Number(shift._entityRev):null;
  const hasRev=expectedRev!=null&&!Number.isNaN(expectedRev);
  let res, data;
  if(hasRev){
    ({ res, data }=await patchShiftPayload(shift, expectedRev));
    if(res.status===404) ({ res, data }=await postShiftPayload(shift, null));
  }else{
    ({ res, data }=await postShiftPayload(shift, null));
    if(res.status===409&&data&&data.error==='shift_already_exists'){
      const rev=data.rev!=null?Number(data.rev):null;
      ({ res, data }=await patchShiftPayload(shift, rev));
    }
  }
  if(res.status===503&&data&&data.error==='shifts_entity_disabled'){
    return { ok:false, fallbackLegacy:true, err:'shifts_entity_disabled' };
  }
  if(!res.ok){
    const msg=data.message||data.error||(`HTTP ${res.status}`);
    return { ok:false, err:data.error||'shift_failed', message:String(msg) };
  }
  await applyShiftApiResponse(data);
  markAdminShiftPushed(shift);
  return { ok:true, dataEpoch:data.dataEpoch };
}
async function syncAdminOrdersAndShiftsFromState(opts={}){
  if(!armadaAdminOrdersShiftsApiActive()) return { ok:true, skipped:true };
  await ensureArmadaApiToken({});
  const syncRole=armadaApiTokenRole();
  if(syncRole!=='admin'&&syncRole!=='owner_driver'){
    return { ok:false, err:'not_admin_role' };
  }
  const onlyOrderId=opts.onlyOrderId?String(opts.onlyOrderId):'';
  const onlyShiftId=opts.onlyShiftId?String(opts.onlyShiftId):'';
  for(const order of state.orders||[]){
    if(!order||!order.id) continue;
    if(!String(order.spaceId||'').trim()) continue;
    if(onlyOrderId&&order.id!==onlyOrderId) continue;
    if(!adminOrderNeedsPush(order)) continue;
    const r=await upsertAdminOrderOnServer(order);
    if(r&&r.fallbackLegacy) return { ok:false, fallbackLegacy:true };
    if(r&&!r.ok) return r;
  }
  for(const shift of state.shifts||[]){
    if(!shift||!shift.id) continue;
    if(!String(shift.spaceId||'').trim()) continue;
    if(onlyShiftId&&shift.id!==onlyShiftId) continue;
    if(!adminShiftNeedsPush(shift)) continue;
    const r=await upsertAdminShiftOnServer(shift);
    if(r&&r.fallbackLegacy) return { ok:false, fallbackLegacy:true };
    if(r&&!r.ok) return r;
  }
  return { ok:true, ordersShiftsSync:true };
}
/** Откат этапа 3: логист снова пишет парк через PATCH /state (localStorage armada_admin_legacy_fleet_state=1). */
function armadaAdminLegacyFleetPush(){
  try{
    if(typeof window!=='undefined'&&window.ARMADA_ADMIN_LEGACY_FLEET_STATE) return true;
    if(typeof localStorage!=='undefined'&&localStorage.getItem('armada_admin_legacy_fleet_state')==='1') return true;
  }catch(_){}
  return false;
}
function armadaAdminFleetApiActive(){
  if(!API_BASE||armadaAdminLegacyFleetPush()) return false;
  return armadaApiTokenRole()==='admin';
}
const armadaFleetPushedSig=new Map();
function fleetEntityCloneForApi(item){
  const copy=structuredClone(item);
  delete copy._entityRev;
  return copy;
}
function armadaFleetItemSig(kind, item){
  if(!item||!item.id) return '';
  const copy=fleetEntityCloneForApi(item);
  if(kind==='driver') delete copy.pin;
  return `${kind}:${item.id}:${JSON.stringify(copy)}`;
}
function fleetNeedsPush(kind, item){
  const sig=armadaFleetItemSig(kind, item);
  if(!sig) return false;
  return armadaFleetPushedSig.get(sig.split(':')[1]+':'+kind)!==sig;
}
function markFleetPushed(kind, item){
  const sig=armadaFleetItemSig(kind, item);
  if(!sig) return;
  armadaFleetPushedSig.set(`${item.id}:${kind}`, sig);
}
async function postFleetEntityPayload(kind, spaceId, item, expectedRev){
  const bodyKey=kind==='vehicle'?'vehicle':kind==='driver'?'driver':'company';
  const body={ [bodyKey]:fleetEntityCloneForApi(item) };
  if(expectedRev!=null&&!Number.isNaN(Number(expectedRev))) body.expectedRev=Number(expectedRev);
  const path=`/spaces/${encodeURIComponent(spaceId)}/${kind==='vehicle'?'vehicles':kind==='driver'?'drivers':'companies'}`;
  const res=await fetchArmadaApi(path, {
    method:'POST',
    headers:armadaApiJsonHeaders(),
    body:JSON.stringify(body),
  }, PATCH_TIMEOUT_MS, true);
  const data=await res.json().catch(()=>({}));
  return { res, data, bodyKey };
}
async function patchFleetEntityPayload(kind, item, expectedRev){
  const bodyKey=kind==='vehicle'?'vehicle':kind==='driver'?'driver':'company';
  const body={ [bodyKey]:fleetEntityCloneForApi(item) };
  if(expectedRev!=null&&!Number.isNaN(Number(expectedRev))) body.expectedRev=Number(expectedRev);
  const idPath=kind==='vehicle'?'vehicles':kind==='driver'?'drivers':'companies';
  const path=`/${idPath}/${encodeURIComponent(item.id)}`;
  const res=await fetchArmadaApi(path, {
    method:'PATCH',
    headers:armadaApiJsonHeaders(),
    body:JSON.stringify(body),
  }, PATCH_TIMEOUT_MS, true);
  const data=await res.json().catch(()=>({}));
  return { res, data, bodyKey };
}
function applyFleetEntityToState(kind, saved, rev){
  if(!saved||!saved.id) return;
  const withRev={...saved};
  if(rev) withRev._entityRev=rev;
  const key=kind==='vehicle'?'vehicles':kind==='driver'?'drivers':'companies';
  const list=state[key]||(state[key]=[]);
  const i=list.findIndex(x=>x&&x.id===saved.id);
  if(i>=0) list[i]={...list[i], ...withRev};
  else list.unshift(withRev);
}
async function applyFleetApiResponse(kind, data){
  if(data&&data.dataEpoch!=null){
    const epoch=Number(data.dataEpoch)||0;
    if(epoch>(Number(state.dataEpoch)||0)) state.dataEpoch=epoch;
  }
  const bodyKey=kind==='vehicle'?'vehicle':kind==='driver'?'driver':'company';
  const saved=data&&data[bodyKey];
  const rev=data&&data.rev!=null?Number(data.rev):null;
  if(saved) applyFleetEntityToState(kind, saved, rev);
  try{
    if(data&&data.payload&&typeof mergeFullRemotePreservingLocal==='function'){
      mergeFullRemotePreservingLocal(data.payload);
    }
  }catch(err){
    console.warn('fleet api payload merge', err);
  }
  if(saved) markFleetPushed(kind, saved);
  persistLocalOnly();
  touchSyncServerOk();
}
async function upsertFleetEntityOnServer(kind, item){
  if(!item||!item.id) return { ok:false, err:'no_item' };
  const spaceId=String(item.spaceId||'').trim();
  if(!spaceId) return { ok:false, err:'no_space_id', message:'Нет spaceId у записи парка' };
  const disabledErr=kind==='vehicle'?'vehicles_entity_disabled':kind==='driver'?'drivers_entity_disabled':'companies_entity_disabled';
  let expectedRev=item._entityRev!=null?Number(item._entityRev):null;
  const hasRev=expectedRev!=null&&!Number.isNaN(expectedRev);
  for(let attempt=0; attempt<4; attempt++){
    if(attempt>0) await new Promise(r=>setTimeout(r, 350*attempt));
    let res, data, bodyKey;
    if(hasRev){
      ({ res, data, bodyKey }=await patchFleetEntityPayload(kind, item, expectedRev));
      if(res.status===404) ({ res, data, bodyKey }=await postFleetEntityPayload(kind, spaceId, item, null));
    }else{
      ({ res, data, bodyKey }=await postFleetEntityPayload(kind, spaceId, item, null));
      if(res.status===409&&data&&data.error==='already_exists'){
        const rev=data.rev!=null?Number(data.rev):null;
        ({ res, data, bodyKey }=await patchFleetEntityPayload(kind, item, rev));
      }
    }
    if(res.status===409&&data&&data.error==='rev_conflict'&&data.rev!=null){
      item._entityRev=Number(data.rev);
      expectedRev=item._entityRev;
      continue;
    }
    if(res.status===503&&data&&data.error===disabledErr){
      return { ok:false, fallbackLegacy:true, err:disabledErr };
    }
    if(!res.ok){
      const msg=data.message||data.error||(`HTTP ${res.status}`);
      return { ok:false, err:data.error||'fleet_failed', message:String(msg) };
    }
    await applyFleetApiResponse(kind, data);
    return { ok:true, rev:data.rev, dataEpoch:data.dataEpoch };
  }
  return { ok:false, err:'fleet_conflict', message:'Конфликт версии парка — обновите страницу' };
}
async function syncAdminFleetEntitiesFromState(opts={}){
  if(!armadaAdminFleetApiActive()) return { ok:true, skipped:true };
  await ensureArmadaApiToken({});
  if(armadaApiTokenRole()!=='admin'){
    return { ok:false, err:'not_admin_role' };
  }
  const kinds=[
    { kind:'vehicle', list:state.vehicles||[] },
    { kind:'driver', list:state.drivers||[] },
    { kind:'company', list:state.companies||[] },
  ];
  const onlyId=opts.onlyId?String(opts.onlyId):'';
  const onlyKind=opts.onlyKind||'';
  for(const { kind, list } of kinds){
    if(onlyKind&&onlyKind!==kind) continue;
    for(const item of list){
      if(!item||!item.id) continue;
      if(!String(item.spaceId||'').trim()) continue;
      if(onlyId&&item.id!==onlyId) continue;
      if(!fleetNeedsPush(kind, item)) continue;
      const r=await upsertFleetEntityOnServer(kind, item);
      if(r&&r.fallbackLegacy) return { ok:false, fallbackLegacy:true };
      if(r&&!r.ok) return r;
    }
  }
  return { ok:true, fleetSync:true };
}
/** Одна запись парка — POST/PATCH entity API (логист). */
async function persistAdminFleetEntityImmediate(kind, itemOrId){
  persistLocalOnly();
  if(navigator.onLine===false){
    syncStatus='local';
    if(typeof updateSyncHint==='function') updateSyncHint();
    return { ok:false, offline:true };
  }
  const key=kind==='vehicle'?'vehicles':kind==='driver'?'drivers':'companies';
  let item=itemOrId;
  if(typeof item==='string'){
    item=(state[key]||[]).find(x=>x&&x.id===itemOrId)||null;
  }
  if(!item||!item.id) return { ok:false, err:'no_item' };
  abortQueuedStatePush();
  if(syncPushInFlight){
    try{ await syncPushInFlight; }catch(_){}
  }
  abortQueuedStatePush();
  syncStatus='syncing';
  if(typeof updateSyncHint==='function') updateSyncHint();
  let lastErr=null;
  for(let attempt=0; attempt<3; attempt++){
    if(attempt>0) await new Promise(r=>setTimeout(r, 400*attempt));
    try{
      const r=await upsertFleetEntityOnServer(kind, item);
      if(r&&r.fallbackLegacy){
        return pushServerState(null, { forceLegacyFleet:true });
      }
      if(r&&r.ok){
        abortQueuedStatePush();
        applySyncPushSuccess();
        return r;
      }
      if(r&&r.offline) return r;
      lastErr=new Error(r&&r.message?r.message:(r&&r.err)||'fleet_sync_failed');
    }catch(err){
      lastErr=err;
      console.warn('admin fleet push attempt', attempt+1, err);
    }
  }
  applySyncPushFailure(lastErr, 'admin fleet push');
  return { ok:false, offline:false, err:lastErr, message:lastErr&&lastErr.message?String(lastErr.message):'Не удалось сохранить парк на сервере' };
}
function snapshotStripOrdersShiftsForEntityApi(payload){
  if(!payload||typeof payload!=='object') return payload;
  if(!armadaAdminOrdersShiftsApiActive()) return payload;
  const out=structuredClone(payload);
  if(Array.isArray(out.orders)){
    const legacy=out.orders.filter(o=>o&&o.id&&!String(o.spaceId||'').trim());
    if(legacy.length) out.orders=legacy;
    else delete out.orders;
  }
  if(Array.isArray(out.shifts)){
    const legacySh=out.shifts.filter(s=>s&&s.id&&!String(s.spaceId||'').trim());
    if(legacySh.length) out.shifts=legacySh;
    else delete out.shifts;
  }
  return out;
}
function snapshotStripFleetForEntityApi(payload){
  if(!payload||typeof payload!=='object') return payload;
  if(!armadaAdminFleetApiActive()) return payload;
  const out=structuredClone(payload);
  delete out.vehicles;
  delete out.drivers;
  delete out.companies;
  return out;
}
/** Откат этапа 4: кабинеты/админы/настройки снова через PATCH /state. */
function armadaAdminLegacyTenantPush(){
  try{
    if(typeof window!=='undefined'&&window.ARMADA_ADMIN_LEGACY_TENANT_STATE) return true;
    if(typeof localStorage!=='undefined'&&localStorage.getItem('armada_admin_legacy_tenant_state')==='1') return true;
  }catch(_){}
  return false;
}
function armadaAdminTenantApiActive(){
  if(!API_BASE||armadaAdminLegacyTenantPush()) return false;
  return armadaApiTokenRole()==='admin';
}
function armadaAdminIsSuperSession(){
  try{
    if(typeof currentAdmin!=='undefined'&&currentAdmin&&currentAdmin.isSuper) return true;
  }catch(_){}
  const p=decodeArmadaJwtPayload(armadaApiToken());
  return !!(p&&p.isSuper);
}
const armadaTenantPushedSig=new Map();
function tenantItemSig(kind, item){
  if(kind==='settings'){
    return `settings:${JSON.stringify({ settings:state.settings||{}, finance:state.finance||{} })}`;
  }
  if(!item||!item.id) return '';
  const copy=structuredClone(item);
  delete copy._entityRev;
  if(kind==='admin') delete copy.pin;
  return `${kind}:${item.id}:${JSON.stringify(copy)}`;
}
async function patchSpacePayload(space, expectedRev){
  const body={ space:fleetEntityCloneForApi(space) };
  if(expectedRev!=null&&!Number.isNaN(Number(expectedRev))) body.expectedRev=Number(expectedRev);
  const res=await fetchArmadaApi(`/spaces/${encodeURIComponent(space.id)}`, {
    method:'PATCH',
    headers:armadaApiJsonHeaders(),
    body:JSON.stringify(body),
  }, PATCH_TIMEOUT_MS, true);
  const data=await res.json().catch(()=>({}));
  return { res, data };
}
async function patchAdminPayload(admin, expectedRev){
  const body={ admin:fleetEntityCloneForApi(admin) };
  if(expectedRev!=null&&!Number.isNaN(Number(expectedRev))) body.expectedRev=Number(expectedRev);
  const res=await fetchArmadaApi(`/admins/${encodeURIComponent(admin.id)}`, {
    method:'PATCH',
    headers:armadaApiJsonHeaders(),
    body:JSON.stringify(body),
  }, PATCH_TIMEOUT_MS, true);
  const data=await res.json().catch(()=>({}));
  return { res, data };
}
async function patchTenantSettingsPayload(){
  const body={
    settings:structuredClone(state.settings||{}),
    finance:structuredClone(state.finance||{}),
  };
  const res=await fetchArmadaApi('/tenant/settings', {
    method:'PATCH',
    headers:armadaApiJsonHeaders(),
    body:JSON.stringify(body),
  }, PATCH_TIMEOUT_MS, true);
  const data=await res.json().catch(()=>({}));
  return { res, data };
}
function applyTenantApiPayload(data){
  if(data&&data.dataEpoch!=null){
    const epoch=Number(data.dataEpoch)||0;
    if(epoch>(Number(state.dataEpoch)||0)) state.dataEpoch=epoch;
  }
  if(data&&data.space){
    const s=data.space;
    const list=state.spaces||(state.spaces=[]);
    const i=list.findIndex(x=>x&&x.id===s.id);
    const withRev={...s};
    if(data.rev) withRev._entityRev=data.rev;
    if(i>=0) list[i]={...list[i], ...withRev};
    else list.unshift(withRev);
  }
  if(data&&data.admin){
    const a=data.admin;
    const list=state.admins||(state.admins=[]);
    const i=list.findIndex(x=>x&&x.id===a.id);
    const withRev={...a};
    if(data.rev) withRev._entityRev=data.rev;
    if(i>=0) list[i]={...list[i], ...withRev};
    else list.unshift(withRev);
  }
  if(data&&data.settings) state.settings={...(state.settings||{}), ...data.settings};
  if(data&&data.finance) state.finance={...(state.finance||{}), ...data.finance};
  try{
    if(data&&data.payload&&typeof mergeFullRemotePreservingLocal==='function'){
      mergeFullRemotePreservingLocal(data.payload);
    }
  }catch(err){ console.warn('tenant api merge', err); }
  persistLocalOnly();
  touchSyncServerOk();
}
async function syncAdminTenantEntitiesFromState(){
  if(!armadaAdminTenantApiActive()) return { ok:true, skipped:true };
  await ensureArmadaApiToken({});
  const isSuper=armadaAdminIsSuperSession();
  for(const sp of (state.spaces||[])){
    if(!sp||!sp.id) continue;
    const sig=tenantItemSig('space', sp);
    if(armadaTenantPushedSig.get(`space:${sp.id}`)===sig) continue;
    const expectedRev=sp._entityRev!=null?Number(sp._entityRev):null;
    const { res, data }=await patchSpacePayload(sp, expectedRev);
    if(res.status===503&&data&&data.error==='spaces_entity_disabled'){
      return { ok:false, fallbackLegacy:true };
    }
    if(!res.ok) return { ok:false, err:data.error||'space_failed', message:data.message||data.error };
    await applyTenantApiPayload(data);
    armadaTenantPushedSig.set(`space:${sp.id}`, sig);
  }
  for(const adm of (state.admins||[])){
    if(!adm||!adm.id) continue;
    const sig=tenantItemSig('admin', adm);
    if(armadaTenantPushedSig.get(`admin:${adm.id}`)===sig) continue;
    const expectedRev=adm._entityRev!=null?Number(adm._entityRev):null;
    const { res, data }=await patchAdminPayload(adm, expectedRev);
    if(res.status===503&&data&&data.error==='admins_entity_disabled'){
      return { ok:false, fallbackLegacy:true };
    }
    if(!res.ok) return { ok:false, err:data.error||'admin_failed', message:data.message||data.error };
    await applyTenantApiPayload(data);
    armadaTenantPushedSig.set(`admin:${adm.id}`, sig);
  }
  if(isSuper){
    const sig=tenantItemSig('settings');
    if(armadaTenantPushedSig.get('settings')!==sig){
      const { res, data }=await patchTenantSettingsPayload();
      if(res.status===503&&data&&data.error==='settings_entity_disabled'){
        return { ok:false, fallbackLegacy:true };
      }
      if(!res.ok) return { ok:false, err:data.error||'settings_failed', message:data.message||data.error };
      await applyTenantApiPayload(data);
      armadaTenantPushedSig.set('settings', sig);
    }
  }
  return { ok:true, tenantSync:true };
}
/** Откат этапа 5: документы снова через PATCH /state. */
function armadaAdminLegacyDocumentsPush(){
  try{
    if(typeof window!=='undefined'&&window.ARMADA_ADMIN_LEGACY_DOCUMENTS_STATE) return true;
    if(typeof localStorage!=='undefined'&&localStorage.getItem('armada_admin_legacy_documents_state')==='1') return true;
  }catch(_){}
  return false;
}
function armadaAdminDocumentsApiActive(){
  if(!API_BASE||armadaAdminLegacyDocumentsPush()) return false;
  return armadaApiTokenRole()==='admin';
}
const armadaDocumentsPushedSig=new Map();
function documentsItemSig(kind, item){
  if(kind==='space-docs'){
    const sid=item&&item.spaceId;
    const tpl=sid&&state.docTemplates&&state.docTemplates.spaces?state.docTemplates.spaces[sid]:null;
    return `space-docs:${sid}:${JSON.stringify(tpl||{})}:${JSON.stringify(state.contractsCounter||{})}`;
  }
  if(kind==='epd'){
    return `epd:${item.spaceId}:${JSON.stringify(item.epd||{})}`;
  }
  if(!item||!item.id) return '';
  const copy=structuredClone(item);
  delete copy._entityRev;
  return `${kind}:${item.id}:${JSON.stringify(copy)}`;
}
async function patchContractPayload(contract, expectedRev){
  const body={ contract:fleetEntityCloneForApi(contract) };
  if(expectedRev!=null&&!Number.isNaN(Number(expectedRev))) body.expectedRev=Number(expectedRev);
  const sid=String(contract.spaceId||'').trim();
  const useCreate=expectedRev==null||Number.isNaN(Number(expectedRev))||Number(expectedRev)===0;
  const url=useCreate&&sid
    ? `/spaces/${encodeURIComponent(sid)}/contracts`
    : `/contracts/${encodeURIComponent(contract.id)}`;
  const method=useCreate&&sid?'POST':'PATCH';
  const res=await fetchArmadaApi(url, {
    method,
    headers:armadaApiJsonHeaders(),
    body:JSON.stringify(body),
  }, PATCH_TIMEOUT_MS, true);
  const data=await res.json().catch(()=>({}));
  return { res, data };
}
async function patchInvoicePayload(invoice, expectedRev){
  const body={ invoice:fleetEntityCloneForApi(invoice) };
  if(expectedRev!=null&&!Number.isNaN(Number(expectedRev))) body.expectedRev=Number(expectedRev);
  const sid=String(invoice.spaceId||'').trim();
  const useCreate=expectedRev==null||Number.isNaN(Number(expectedRev))||Number(expectedRev)===0;
  const url=useCreate&&sid
    ? `/spaces/${encodeURIComponent(sid)}/invoices`
    : `/invoices/${encodeURIComponent(invoice.id)}`;
  const method=useCreate&&sid?'POST':'PATCH';
  const res=await fetchArmadaApi(url, {
    method,
    headers:armadaApiJsonHeaders(),
    body:JSON.stringify(body),
  }, PATCH_TIMEOUT_MS, true);
  const data=await res.json().catch(()=>({}));
  return { res, data };
}
async function patchSpaceDocumentsBundle(spaceId, expectedRev){
  const sid=String(spaceId||'').trim();
  const templates=state.docTemplates&&state.docTemplates.spaces&&state.docTemplates.spaces[sid]
    ? state.docTemplates.spaces[sid]
    : {};
  const body={
    docTemplates:{ spaces:{ [sid]:templates }, platform:(state.docTemplates&&state.docTemplates.platform)||{} },
    contractsCounter:state.contractsCounter||null,
  };
  if(expectedRev!=null&&!Number.isNaN(Number(expectedRev))) body.expectedRev=Number(expectedRev);
  const res=await fetchArmadaApi(`/spaces/${encodeURIComponent(sid)}/documents`, {
    method:'PATCH',
    headers:armadaApiJsonHeaders(),
    body:JSON.stringify(body),
  }, PATCH_TIMEOUT_MS, true);
  const data=await res.json().catch(()=>({}));
  return { res, data };
}
function applyDocumentsApiPayload(data){
  if(data&&data.dataEpoch!=null){
    const epoch=Number(data.dataEpoch)||0;
    if(epoch>(Number(state.dataEpoch)||0)) state.dataEpoch=epoch;
  }
  if(data&&data.contract){
    const c=data.contract;
    const list=state.contracts||(state.contracts=[]);
    const i=list.findIndex(x=>x&&x.id===c.id);
    const withRev={...c};
    if(data.rev) withRev._entityRev=data.rev;
    if(i>=0) list[i]={...list[i], ...withRev};
    else list.unshift(withRev);
  }
  if(data&&data.invoice){
    const inv=data.invoice;
    const list=state.invoices||(state.invoices=[]);
    const i=list.findIndex(x=>x&&x.id===inv.id);
    const withRev={...inv};
    if(data.rev) withRev._entityRev=data.rev;
    if(i>=0) list[i]={...list[i], ...withRev};
    else list.unshift(withRev);
  }
  if(data&&data.docTemplates&&typeof applyDocTemplatesPayload==='function'){
    applyDocTemplatesPayload(data.docTemplates);
  }else if(data&&data.docTemplates&&data.docTemplates.spaces){
    if(!state.docTemplates) state.docTemplates={spaces:{}, platform:{}};
    Object.assign(state.docTemplates.spaces, data.docTemplates.spaces);
    if(data.docTemplates.platform) state.docTemplates.platform=data.docTemplates.platform;
  }
  if(data&&data.contractsCounter) state.contractsCounter=data.contractsCounter;
  if(data&&data.epd&&data.spaceId){
    if(!state.epdBySpace) state.epdBySpace={};
    state.epdBySpace[data.spaceId]=data.epd;
  }
  try{
    if(data&&data.payload&&typeof mergeFullRemotePreservingLocal==='function'){
      mergeFullRemotePreservingLocal(data.payload);
    }
  }catch(err){ console.warn('documents api merge', err); }
  persistLocalOnly();
  touchSyncServerOk();
}
async function syncAdminDocumentsFromState(){
  if(!armadaAdminDocumentsApiActive()) return { ok:true, skipped:true };
  await ensureArmadaApiToken({});
  const spaceIds=new Set();
  (state.contracts||[]).forEach(c=>{ if(c&&c.spaceId) spaceIds.add(c.spaceId); });
  (state.invoices||[]).forEach(i=>{ if(i&&i.spaceId) spaceIds.add(i.spaceId); });
  if(state.docTemplates&&state.docTemplates.spaces){
    Object.keys(state.docTemplates.spaces).forEach(sid=>spaceIds.add(sid));
  }
  Object.keys(state.epdBySpace||{}).forEach(sid=>spaceIds.add(sid));
  if(typeof currentSpaceId==='function'){
    const cs=currentSpaceId();
    if(cs) spaceIds.add(cs);
  }
  for(const c of (state.contracts||[])){
    if(!c||!c.id) continue;
    const sig=documentsItemSig('contract', c);
    if(armadaDocumentsPushedSig.get(`contract:${c.id}`)===sig) continue;
    const expectedRev=c._entityRev!=null?Number(c._entityRev):null;
    const { res, data }=await patchContractPayload(c, expectedRev);
    if(res.status===503&&(data.error==='contracts_entity_disabled'||data.error==='invoices_entity_disabled')){
      return { ok:false, fallbackLegacy:true };
    }
    if(!res.ok) return { ok:false, err:data.error||'contract_failed', message:data.message||data.error };
    await applyDocumentsApiPayload(data);
    armadaDocumentsPushedSig.set(`contract:${c.id}`, sig);
  }
  for(const inv of (state.invoices||[])){
    if(!inv||!inv.id) continue;
    const sig=documentsItemSig('invoice', inv);
    if(armadaDocumentsPushedSig.get(`invoice:${inv.id}`)===sig) continue;
    const expectedRev=inv._entityRev!=null?Number(inv._entityRev):null;
    const { res, data }=await patchInvoicePayload(inv, expectedRev);
    if(res.status===503&&data.error==='invoices_entity_disabled'){
      return { ok:false, fallbackLegacy:true };
    }
    if(!res.ok) return { ok:false, err:data.error||'invoice_failed', message:data.message||data.error };
    await applyDocumentsApiPayload(data);
    armadaDocumentsPushedSig.set(`invoice:${inv.id}`, sig);
  }
  for(const sid of spaceIds){
    const sig=documentsItemSig('space-docs', { spaceId:sid });
    if(armadaDocumentsPushedSig.get(`space-docs:${sid}`)!==sig){
      const { res, data }=await patchSpaceDocumentsBundle(sid, null);
      if(res.status===503&&data.error==='doc_templates_entity_disabled'){
        return { ok:false, fallbackLegacy:true };
      }
      if(!res.ok) return { ok:false, err:data.error||'space_docs_failed', message:data.message||data.error };
      await applyDocumentsApiPayload(data);
      armadaDocumentsPushedSig.set(`space-docs:${sid}`, sig);
    }
    const epdRec=state.epdBySpace&&state.epdBySpace[sid];
    if(epdRec){
      const epSig=documentsItemSig('epd', { spaceId:sid, epd:epdRec });
      if(armadaDocumentsPushedSig.get(`epd:${sid}`)!==epSig){
        const headers=armadaApiJsonHeaders();
        const res=await fetchArmadaApi(`/spaces/${encodeURIComponent(sid)}/epd-connection`, {
          method:'PATCH', headers, body:JSON.stringify({ epd:epdRec })
        }, PATCH_TIMEOUT_MS, true);
        const data=await res.json().catch(()=>({}));
        if(res.status===503&&data.error==='epd_entity_disabled'){
          return { ok:false, fallbackLegacy:true };
        }
        if(!res.ok) return { ok:false, err:data.error||'epd_failed', message:data.message||data.error };
        await applyDocumentsApiPayload({ ...data, spaceId:sid });
        armadaDocumentsPushedSig.set(`epd:${sid}`, epSig);
      }
    }
  }
  return { ok:true, documentsSync:true };
}
function snapshotStripDocumentsForEntityApi(payload){
  if(!payload||typeof payload!=='object') return payload;
  if(!armadaAdminDocumentsApiActive()) return payload;
  const out=structuredClone(payload);
  delete out.contracts;
  delete out.invoices;
  delete out.docTemplates;
  delete out.contractsCounter;
  delete out.epdBySpace;
  return out;
}
const STATE_SERVICE_PATCH_KEYS=new Set([
  'dataEpoch','seq','opsLog','adminLogins','adminPresence','deletedOrderIds','deletedDriverKeys',
]);
function statePushPayloadIsServiceMetaOnly(payload){
  if(!payload||typeof payload!=='object') return false;
  const keys=Object.keys(payload);
  if(!keys.length) return true;
  return keys.every(k=>STATE_SERVICE_PATCH_KEYS.has(k));
}
function snapshotStripEntityCollectionsForApi(payload){
  if(!payload||typeof payload!=='object') return payload;
  let out=snapshotStripOrdersShiftsForEntityApi(payload);
  out=snapshotStripFleetForEntityApi(out);
  out=snapshotStripDocumentsForEntityApi(out);
  if(!armadaAdminTenantApiActive()) return out;
  if(out===payload) out=structuredClone(payload);
  delete out.spaces;
  delete out.admins;
  if(armadaAdminIsSuperSession()){
    delete out.settings;
    delete out.finance;
  }
  return out;
}
async function patchServerStatePayload(payload, _retry401, prevPlainPins){
  if(API_BASE){
    try{
      if(armadaCustomerPortalActive() && typeof ensureCustomerPortalApiToken==='function'){
        await ensureCustomerPortalApiToken();
      }
      await ensureArmadaApiToken({});
      if(armadaApiTokenRole()==='sync'&&!armadaApiRoleTokenUsable()){
        return { ok:false, aborted:true, reason:'sync_read_only' };
      }
      if(armadaCustomerMustNotPatchState()){
        return { ok:false, aborted:true, reason:'customer_read_only' };
      }
      if(armadaDriverMustNotPatchState()){
        return { ok:false, aborted:true, reason:'driver_use_shifts_api' };
      }
      payload=snapshotStripEntityCollectionsForApi(payload);
      const res=await fetchArmadaApi('/state', {
        method:'PATCH',
        headers:armadaApiJsonHeadersForWrite(),
        body:JSON.stringify({ payload })
      }, PATCH_TIMEOUT_MS, !!_retry401);
      const data=await res.json().catch(()=>({}));
      if(res.status===409){
        const c=parseApiStateConflict(data);
        if(c.recordId) pbRecordId=c.recordId;
        if(c.stateGuardShrink){
          return {
            ok:false, aborted:true, stateGuardShrink:true, shrunk:c.shrunk,
            viaApi:true,
          };
        }
        return { ok:false, aborted:true, remotePayload:c.remotePayload, remoteEpoch:c.remoteEpoch, viaApi:true };
      }
      if(!res.ok){
        const msg=data.message||data.error||('API patch '+res.status);
        const err=new Error(msg);
        err.apiError=data.error;
        err.httpStatus=res.status;
        throw err;
      }
      armadaCaptureStateEtagFromResponse(res);
      if(data.ownerSubscriptionWarning){
        syncOwnerSubscriptionWarning=String(data.ownerSubscriptionWarning);
      }else{
        syncOwnerSubscriptionWarning='';
      }
      if(data.recordId) pbRecordId=data.recordId;
      if(data.id) pbRecordId=data.id;
      syncPullDegraded=false;
      touchSyncServerOk();
      const ignored=Array.isArray(data.ignoredAuthFields)?data.ignoredAuthFields:[];
      if(ignored.length){
        const ign=pushResultFromIgnored(ignored, data.payload, prevPlainPins);
        return { ok:false, aborted:false, viaApi:true, ...ign };
      }
      return { ok:true, aborted:false, viaApi:true, ownerSubscriptionWarning:data.ownerSubscriptionWarning||null };
    }catch(err){
      console.warn('API patch', err);
      throw err;
    }
  }
  const body={ key:'main', payload };
  if(pbRecordId){
    const res=await fetchWithTimeout(`${PB_BASE}/api/collections/app_state/records/${pbRecordId}`,{
      method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)
    });
    if(!res.ok) throw new Error('Не удалось сохранить ('+res.status+')');
    return { ok:true, aborted:false };
  }
  const res=await fetchWithTimeout(`${PB_BASE}/api/collections/app_state/records`,{
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)
  });
  if(res.ok){
    const rec=await res.json();
    pbRecordId=rec.id;
    return { ok:true, aborted:false };
  }
  const existing=await fetchServerStateFromPb();
  if(!existing) throw new Error('Не удалось создать запись базы');
  pbRecordId=existing.id;
  const res2=await fetchWithTimeout(`${PB_BASE}/api/collections/app_state/records/${pbRecordId}`,{
    method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)
  });
  if(!res2.ok) throw new Error('Не удалось сохранить ('+res2.status+')');
  return { ok:true, aborted:false };
}
async function mergeRemoteAheadOnPush(remote){
  if(!remote||typeof remote!=='object') return {aborted:true, reason:'remote_ahead'};
  unionDeletedOrderIds(remote.deletedOrderIds||[]);
  state.orders=stripCancelledFromOrders(state.orders);
  (state.shifts||[]).forEach(s=>{ if(Array.isArray(s.orders)) s.orders=stripCancelledFromOrders(s.orders); });
  const remoteEpoch=Number(remote.dataEpoch)||0;
  const localEpoch=Number(state.dataEpoch)||0;
  if(remoteEpoch<=localEpoch) return {aborted:false};
  const localShifts=(state.shifts||[]).map(s=>structuredClone(s));
  const localOrders=(state.orders||[]).map(o=>structuredClone(o));
  const localInvoices=(state.invoices||[]).map(i=>structuredClone(i));
  const liveShift=state.shift && !state.shift.endedAt ? structuredClone(state.shift) : null;
  applyPayload(remote, {remoteSeq:true, remoteWinsAuth:true});
  let merged=false;
  if(mergeLocalShifts(localShifts)) merged=true;
  if(liveShift && mergeLocalShifts([liveShift])) merged=true;
  if(mergeLocalOrders(localOrders)) merged=true;
  if(typeof mergeLocalInvoices==='function'&&mergeLocalInvoices(localInvoices)) merged=true;
  if(typeof reconcileOrdersAfterSync==='function'&&reconcileOrdersAfterSync()) merged=true;
  else if(typeof healOrphanOrdersIntoShifts==='function'&&healOrphanOrdersIntoShifts()) merged=true;
  if(migrateEtoFromMessages()) merged=true;
  if(merged){
    bumpDataEpoch('merge-local-remote-ahead');
    writeLocalStorageSnapshot();
    try{
      await patchServerStatePayload(snapshot());
      touchSyncServerOk();
      console.warn('push merged local into remote epoch', remoteEpoch);
      return {aborted:false, merged:true};
    }catch(e){ console.warn('merge push', e); }
  } else {
    writeLocalStorageSnapshot();
  }
  console.warn('PB push aborted: remote epoch ahead', remoteEpoch, '>', localEpoch);
  return {aborted:true, reason:'remote_ahead'};
}
/** Перед push: не затереть на сервере назначение логиста локальной «Диспетчер». */
async function reconcileBeforePush(){
  if(!navigator.onLine||typeof fetchServerState!=='function') return false;
  try{
    const rec=await fetchServerState(4500);
    if(!rec) return false;
    if(rec.unchanged) return false;
    if(!rec.payload) return false;
    const remote=rec.payload;
    pbRecordId=rec.id||pbRecordId;
    const remoteEpoch=Number(remote.dataEpoch)||0;
    const localEpoch=Number(state.dataEpoch)||0;
    const sigBefore=typeof armadaStateComparableSig==='function'?armadaStateComparableSig():'';
    let shiftClose=false;
    if(typeof mergeRemoteShiftClosures==='function'&&mergeRemoteShiftClosures(remote)) shiftClose=true;
    if(localEpoch<remoteEpoch){
      mergeFullRemotePreservingLocal(remote);
      if(shiftClose) bumpDataEpoch('pre-push-remote-shift-close');
      else bumpDataEpoch('pre-push-remote-ahead-merge');
      persistLocalOnly();
      return true;
    }
    if(typeof mergeRemoteOrderAssignments==='function') mergeRemoteOrderAssignments(remote);
    if(typeof reconcileOrdersAfterSync==='function') reconcileOrdersAfterSync();
    const sigAfter=typeof armadaStateComparableSig==='function'?armadaStateComparableSig():'';
    if(sigBefore!==sigAfter){
      if(typeof bumpDataEpochAuto==='function') bumpDataEpochAuto('pre-push-reconcile');
      else bumpDataEpoch('pre-push-reconcile');
      persistLocalOnly();
      return true;
    }
    return false;
  }catch(err){
    console.warn('pre-push reconcile', err);
    return false;
  }
}
/** Заказчик не меняет PIN админов/водителей — не слать plain pin в PATCH (ignored_auth_fields). */
function snapshotForApiPush(){
  let payload=snapshot();
  payload=snapshotStripEntityCollectionsForApi(payload);
  if(armadaApiTokenRole()!=='customer') return payload;
  const out=structuredClone(payload);
  delete out.admins;
  if(!Array.isArray(out.customers)||!out.customers.length) delete out.customers;
  if(!Array.isArray(out.drivers)||!out.drivers.length) delete out.drivers;
  else (out.drivers||[]).forEach(d=>{ if(d) delete d.pin; });
  if(!Array.isArray(out.vehicles)||!out.vehicles.length) delete out.vehicles;
  return out;
}
async function pushServerState(prevPlainPins, opts={}){
  if(API_BASE){
    if(armadaCustomerPortalActive() && typeof ensureCustomerPortalApiToken==='function'){
      await ensureCustomerPortalApiToken();
    }
    if(!armadaApiPreserveDriverJwtInCabinet()) await ensureArmadaApiToken({});
  }
  if(API_BASE&&armadaCustomerMustNotPatchState()){
    try{
      const r=await flushCustomerPortalSyncQueue();
      if(!r||!r.ok) throw new Error(r&&r.err||'customer_portal_sync');
      return {aborted:false, ok:true, customerOrderSync:true, flushed:r&&r.flushed};
    }catch(err){
      console.warn('customer portal push', err);
      throw err;
    }
  }
  if(API_BASE&&armadaApiTokenRole()==='sync'&&!armadaApiRoleTokenUsable()){
    return {aborted:false, syncReadOnly:true};
  }
  if(API_BASE&&armadaDriverMustNotPatchState()&&!opts.forceLegacyState){
    try{
      const r=await persistDriverShiftImmediate({ prevPlainPins });
      if(r&&r.skipped) return {aborted:false, ok:true, driverShiftSync:true, skipped:true};
      if(r&&r.ok) return {aborted:false, ok:true, driverShiftSync:true, rev:r.rev, dataEpoch:r.dataEpoch};
      if(r&&r.offline) return {aborted:false, ok:false, offline:true};
      throw new Error(r&&r.message?r.message:(r&&r.err)||'driver_shift_sync_failed');
    }catch(err){
      console.warn('driver shift sync', err);
      throw err;
    }
  }
  const forceLegacyOrdersShifts=!!opts.forceLegacyOrdersShifts||!!opts.forceLegacyState;
  const forceLegacyFleet=!!opts.forceLegacyFleet||!!opts.forceLegacyState;
  const forceLegacyTenant=!!opts.forceLegacyTenant||!!opts.forceLegacyState;
  const forceLegacyDocuments=!!opts.forceLegacyDocuments||!!opts.forceLegacyState;
  let ordersShiftsEntitySyncOk=false;
  if(API_BASE&&armadaAdminOrdersShiftsApiActive()&&!forceLegacyOrdersShifts&&!opts.skipOrdersShiftsSync){
    try{
      const osRes=await syncAdminOrdersAndShiftsFromState(opts.ordersShiftsSync||{});
      if(osRes&&osRes.fallbackLegacy){
        return pushServerState(prevPlainPins, { ...opts, forceLegacyOrdersShifts:true });
      }
      if(osRes&&!osRes.ok&&!osRes.skipped){
        throw new Error(osRes.message||(osRes.err)||'admin_orders_shifts_sync_failed');
      }
      if(osRes&&osRes.ok&&osRes.ordersShiftsSync) ordersShiftsEntitySyncOk=true;
    }catch(err){
      console.warn('admin orders/shifts sync', err);
      throw err;
    }
  }
  if(API_BASE&&armadaAdminFleetApiActive()&&!forceLegacyFleet&&!opts.skipFleetSync){
    try{
      const fleetRes=await syncAdminFleetEntitiesFromState(opts.fleetSync||{});
      if(fleetRes&&fleetRes.fallbackLegacy){
        return pushServerState(prevPlainPins, { forceLegacyFleet:true });
      }
      if(fleetRes&&!fleetRes.ok&&!fleetRes.skipped){
        throw new Error(fleetRes.message||(fleetRes.err)||'admin_fleet_sync_failed');
      }
    }catch(err){
      console.warn('admin fleet sync', err);
      throw err;
    }
  }
  if(API_BASE&&armadaAdminTenantApiActive()&&!forceLegacyTenant&&!opts.skipTenantSync){
    try{
      const tenantRes=await syncAdminTenantEntitiesFromState();
      if(tenantRes&&tenantRes.fallbackLegacy){
        return pushServerState(prevPlainPins, { forceLegacyTenant:true });
      }
      if(tenantRes&&!tenantRes.ok&&!tenantRes.skipped){
        throw new Error(tenantRes.message||(tenantRes.err)||'admin_tenant_sync_failed');
      }
    }catch(err){
      console.warn('admin tenant sync', err);
      throw err;
    }
  }
  if(API_BASE&&armadaAdminDocumentsApiActive()&&!forceLegacyDocuments&&!opts.skipDocumentsSync){
    try{
      const docsRes=await syncAdminDocumentsFromState();
      if(docsRes&&docsRes.fallbackLegacy){
        return pushServerState(prevPlainPins, { forceLegacyDocuments:true });
      }
      if(docsRes&&!docsRes.ok&&!docsRes.skipped){
        throw new Error(docsRes.message||(docsRes.err)||'admin_documents_sync_failed');
      }
    }catch(err){
      console.warn('admin documents sync', err);
      throw err;
    }
  }
  if(
    ordersShiftsEntitySyncOk
    &&!forceLegacyOrdersShifts
    &&!forceLegacyFleet
    &&!forceLegacyTenant
    &&!forceLegacyDocuments
    &&!opts.forceStatePush
  ){
    const probe=snapshotForApiPush();
    if(statePushPayloadIsServiceMetaOnly(probe)){
      touchSyncServerOk();
      return {aborted:false, ok:true, statePushSkipped:true};
    }
  }
  const MAX_PUSH_ATTEMPTS=3;
  for(let attempt=0; attempt<MAX_PUSH_ATTEMPTS; attempt++){
    if(attempt>0) await new Promise(r=>setTimeout(r, 400*attempt));
    await reconcileBeforePush();
    const payload=snapshotForApiPush();
    writeLocalStorageSnapshot();
    try{
      const pushed=await patchServerStatePayload(payload, false, prevPlainPins);
      if(pushed.ok) return {aborted:false, ok:true};
      if(pushed.ignoredAuthFields&&pushed.ignoredAuthFields.length){
        return {
          aborted:false,
          ok:false,
          ignoredAuthFields:pushed.ignoredAuthFields,
          message:pushed.message,
          err:'ignored_auth_fields',
        };
      }
      if(pushed.stateGuardShrink&&attempt<MAX_PUSH_ATTEMPTS-1){
        const rec=await fetchServerState(4500);
        if(rec&&rec.unchanged) continue;
        if(rec&&rec.payload){
          pbRecordId=rec.id||pbRecordId;
          mergeFullRemotePreservingLocal(rec.payload);
          bumpDataEpoch('state-guard-shrink-merge');
          persistLocalOnly();
          continue;
        }
      }
      if(pushed.aborted){
        if(pushed.remotePayload) return mergeRemoteAheadOnPush(pushed.remotePayload);
        if(pushed.stateGuardShrink) return {aborted:true, reason:'state_guard_shrink'};
        return {aborted:true, reason:'remote_ahead'};
      }
    }catch(err){
      if(attempt>=MAX_PUSH_ATTEMPTS-1){
        console.warn('PB push', err);
        throw err;
      }
      console.warn('PB push attempt', attempt+1, err);
    }
  }
  throw new Error('Не удалось сохранить');
}
function persist(){
  persistLocalOnly();
  if(navigator.onLine===false){
    syncStatus='local';
    updateDriverNetHint();
    if(typeof updateSyncHint==='function') updateSyncHint();
    return;
  }
  clearTimeout(persistTimer);
  persistTimer=setTimeout(()=>{
    syncStatus='syncing';
    updateDriverNetHint();
    if(typeof updateSyncHint==='function') updateSyncHint();
    pushServerStateQueued()
      .then(()=>applySyncPushSuccess())
      .catch(err=>applySyncPushFailure(err, 'PB sync'));
  }, PERSIST_DEBOUNCE_MS);
}
/** Сохранить PIN админа локально и сразу отправить на сервер (без debounce). */
async function persistAdminPinImmediate(prevPlainPins){
  persistLocalOnly();
  if(navigator.onLine===false){
    syncStatus='local';
    if(typeof updateDriverNetHint==='function') updateDriverNetHint();
    if(typeof updateSyncHint==='function') updateSyncHint();
    return { ok:false, offline:true };
  }
  clearTimeout(persistTimer);
  persistTimer=null;
  syncStatus='syncing';
  if(typeof updateDriverNetHint==='function') updateDriverNetHint();
  if(typeof updateSyncHint==='function') updateSyncHint();
  let lastErr=null;
  for(let attempt=0; attempt<3; attempt++){
    if(attempt>0) await new Promise(r=>setTimeout(r, 800*attempt));
    try{
      const pushRes=await pushServerState(prevPlainPins);
      if(pushRes&&pushRes.ignoredAuthFields&&pushRes.ignoredAuthFields.length){
        applySyncPushFailure(new Error(pushRes.message||'ignored'), 'ignored auth');
        return {
          ok:false,
          err:'ignored_auth_fields',
          message:pushRes.message,
          ignoredAuthFields:pushRes.ignoredAuthFields,
        };
      }
      if(!isPushServerStateSuccess(pushRes)){
        lastErr=new Error(pushServerStateFailureMessage(pushRes));
        if(pushRes&&pushRes.reason) lastErr.pushReason=pushRes.reason;
        console.warn('admin pin push attempt', attempt+1, lastErr);
        continue;
      }
      applySyncPushSuccess();
      return { ok:true };
    }catch(err){
      lastErr=err;
      console.warn('admin pin push attempt', attempt+1, err);
    }
  }
  const failMsg=pushServerStateFailureMessage(null, lastErr);
  applySyncPushFailure(lastErr||new Error(failMsg), 'admin pin push');
  return { ok:false, offline:false, err:lastErr, message:failMsg };
}
/** Сохранить карточку водителя сразу на сервер (PIN и поля). */
async function persistDriverCardImmediate(prevPlainPins){
  return persistAdminPinImmediate(prevPlainPins);
}
/** Сохранить справочник компаний на сервер сразу (без debounce). */
async function persistCompanyImmediate(companyId){
  if(armadaAdminFleetApiActive()&&typeof persistAdminFleetEntityImmediate==='function'&&companyId){
    const r=await persistAdminFleetEntityImmediate('company', companyId);
    if(r&&(r.ok||r.offline)) return r;
    if(r&&!r.fallbackLegacy) return r;
  }
  return persistAdminPinImmediate();
}
/** Назначение водителя/ТС — сразу на сервер (без debounce 2.2 с). */
async function persistOrderAssignmentImmediate(orderId){
  if(typeof currentAdmin!=='undefined'&&currentAdmin&&orderId){
    return persistAdminOrderImmediate(orderId, { isNew:false });
  }
  return persistAdminPinImmediate();
}
/** Изменения ЭТрН в заказе — entity API (не PATCH всего state). */
async function persistOrderEtrnImmediate(orderOrId){
  persistLocalOnly();
  const oid=orderOrId&&typeof orderOrId==='object'?orderOrId.id:orderOrId;
  const order=oid?(state.orders||[]).find(o=>o&&o.id===oid):null;
  if(!oid||!order) return { ok:false, err:'no_order' };
  if(navigator.onLine===false){
    syncStatus='local';
    if(typeof updateSyncHint==='function') updateSyncHint();
    return { ok:false, offline:true };
  }
  if(typeof currentAdmin!=='undefined'&&currentAdmin&&typeof persistAdminOrderImmediate==='function'){
    return persistAdminOrderImmediate(oid, { isNew:false });
  }
  if(typeof currentCustomer!=='undefined'&&currentCustomer&&typeof persistCustomerPortalOrderImmediate==='function'){
    return persistCustomerPortalOrderImmediate(oid);
  }
  if(typeof DRIVER!=='undefined'&&DRIVER&&typeof persistOrderAssignmentImmediate==='function'){
    return persistOrderAssignmentImmediate(oid);
  }
  return { ok:true, localOnly:true };
}
/** T1 грузоотправителя по ссылке /z/?etrn-t1=…&t=… (без входа заказчика). */
async function persistShipperEtrnT1Immediate(orderId, token){
  if(navigator.onLine===false) return { ok:false, offline:true };
  const oid=String(orderId||'').trim();
  const tok=String(token||'').trim();
  if(!oid||!tok) return { ok:false, err:'bad_args' };
  if(!API_BASE) return { ok:false, err:'no_api' };
  let lastErr=null;
  for(let attempt=0; attempt<3; attempt++){
    if(attempt>0) await new Promise(r=>setTimeout(r, 800*attempt));
    try{
      const res=await fetchArmadaApi('/etrn/shipper-t1', {
        method:'POST',
        headers:{ Accept:'application/json', 'Content-Type':'application/json' },
        body:JSON.stringify({
          orderId:oid,
          token:tok,
          dataEpoch:Number(state.dataEpoch)||0,
        }),
      }, PATCH_TIMEOUT_MS, true);
      const data=await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data.error||`shipper_t1 ${res.status}`);
      if(data.dataEpoch!=null){
        const epoch=Number(data.dataEpoch)||0;
        if(epoch>(Number(state.dataEpoch)||0)) state.dataEpoch=epoch;
      }
      if(data.payload&&typeof applyPayload==='function'){
        applyPayload(data.payload, { remoteSeq:true, remoteWinsAuth:true });
        persistLocalOnly();
      }
      touchSyncServerOk();
      return { ok:true, data };
    }catch(err){
      lastErr=err;
      console.warn('shipper T1 push attempt', attempt+1, err);
    }
  }
  return { ok:false, err:lastErr };
}
/** Заявка с портала заказчика — POST /customer/orders (не PATCH всего state). */
async function persistCustomerPortalOrderImmediate(orderId){
  persistLocalOnly();
  if(navigator.onLine===false){
    const oid=resolveCustomerPortalOrderId(orderId);
    if(oid) enqueueCustomerPortalSync(oid);
    syncStatus='local';
    if(typeof updateSyncHint==='function') updateSyncHint();
    return { ok:false, offline:true };
  }
  const oid=resolveCustomerPortalOrderId(orderId);
  if(!oid) return { ok:false, err:'no_order' };
  enqueueCustomerPortalSync(oid);
  syncStatus='syncing';
  if(typeof updateSyncHint==='function') updateSyncHint();
  let lastErr=null;
  for(let attempt=0; attempt<3; attempt++){
    if(attempt>0) await new Promise(r=>setTimeout(r, 800*attempt));
    try{
      const r=await flushCustomerPortalSyncQueue();
      if(!r||!r.ok){
        lastErr=new Error(r&&r.err||'customer_portal_sync');
        console.warn('customer order push attempt', attempt+1, lastErr);
        continue;
      }
      applySyncPushSuccess();
      return { ok:true, flushed:r.flushed };
    }catch(err){
      lastErr=err;
      console.warn('customer order push attempt', attempt+1, err);
    }
  }
  applySyncPushFailure(lastErr, 'customer order push');
  return { ok:false, offline:false, err:lastErr };
}
/** Назначены реальный водитель и ТС (не заглушки логиста/биржи). Дублируется в order-documents.js для /a/ и /z/. */
function orderHasDriverVehicleAssigned(o){
  if(!o) return false;
  const drv=String(o.driverName||'').trim();
  const plate=String(o.vehiclePlate||'').trim();
  if(!drv||!plate||drv==='Биржа'||drv==='Диспетчер'||drv==='—'||plate==='—') return false;
  if(typeof waitingLogistDriver==='function'&&waitingLogistDriver(drv)) return false;
  return true;
}
/** После reconcile: если назначение восстановлено из docs/transportApp — сразу на сервер (только админ). */
async function pushRepairedAssignmentsIfNeeded(beforeSnap){
  if(typeof currentAdmin==='undefined'||!currentAdmin) return false;
  if(!Array.isArray(beforeSnap)||!beforeSnap.length) return false;
  const repaired=(state.orders||[]).some(o=>{
    const b=beforeSnap.find(x=>x.id===o.id);
    if(!b) return false;
    const assignChanged=b.d!==o.driverName||b.p!==o.vehiclePlate||b.f!==o.ownFleetDriverId;
    if(!assignChanged) return false;
    return typeof orderHasDriverVehicleAssigned==='function'&&orderHasDriverVehicleAssigned(o);
  });
  if(!repaired) return false;
  if(typeof bumpDataEpoch==='function') bumpDataEpoch('repair-assign-push');
  persistLocalOnly();
  if(typeof persistOrderAssignmentImmediate==='function'){
    const r=await persistOrderAssignmentImmediate();
    return !!(r&&r.ok);
  }
  persist();
  return true;
}
function orderAssignmentRepairSnap(){
  return (state.orders||[]).map(o=>({id:o.id,d:o.driverName,p:o.vehiclePlate,f:o.ownFleetDriverId}));
}
async function initCloudSync(){
  if(!API_BASE){
    syncStatus='local';
    if(typeof updateSyncHint==='function') updateSyncHint();
    return;
  }
  syncStatus='syncing';
  try{
    const rec=await fetchServerState(INIT_FETCH_MS);
    if(rec){
      pbRecordId=rec.id;
      if(rec.unchanged){
        syncStatus='ok';
        touchSyncServerOk();
        return;
      }
      if(!rec.payload){
        await pushServerState();
        syncStatus='ok';
        touchSyncServerOk();
        return;
      }
      const remote=rec.payload;
      if(armadaRemotePayloadIsLoginBootstrap(remote)){
        mergeLoginCatalogFromRemote(remote);
        if(typeof mergeAdminAuthFromRemote==='function') mergeAdminAuthFromRemote(remote, {remoteWinsAuth:true});
        if(typeof migrateSpaces==='function') migrateSpaces();
        if(typeof migrateDriverPins==='function') migrateDriverPins();
        if(typeof migrateAdmins==='function') migrateAdmins();
        persistLocalOnly();
        syncStatus='ok';
        touchSyncServerOk();
        return;
      }
      const remoteEpoch=Number(remote.dataEpoch)||0;
      const localEpoch=Number(state.dataEpoch)||0;
      // Сервер — источник правды при старте, если эпоха не ниже локальной.
      // Раньше при равной эпохе «более новый» localStorage затирал очистку на сервере.
      if(remoteEpoch>=localEpoch || !localEpoch){
        const localShifts=(state.shifts||[]).map(s=>structuredClone(s));
        const localOrders=(state.orders||[]).map(o=>structuredClone(o));
        applyPayload(remote, {keepShifts:localShifts, keepOrders:localOrders, remoteSeq:true, remoteWinsAuth:true});
        if(typeof healOrphanOrdersIntoShifts==='function') healOrphanOrdersIntoShifts();
        migrateEtoFromMessages();
        const assignSnapBefore=typeof orderAssignmentRepairSnap==='function'?orderAssignmentRepairSnap():[];
        if(typeof reconcileOrdersAfterSync==='function') reconcileOrdersAfterSync();
    writeLocalStorageSnapshot();
        if(typeof pushRepairedAssignmentsIfNeeded==='function') await pushRepairedAssignmentsIfNeeded(assignSnapBefore);
      } else {
        // Локальная эпоха выше — tombstone удалений с сервера всё равно применяем.
        unionDeletedOrderIds(remote.deletedOrderIds||[]);
        if(typeof purgeDeadOrdersEverywhere==='function') purgeDeadOrdersEverywhere();
        if(typeof pruneInvoicesForDeletedOrders==='function') pruneInvoicesForDeletedOrders();
        if(typeof mergeRemoteOrderAssignments==='function'&&mergeRemoteOrderAssignments(remote)) bumpDataEpoch('merge-remote-assign-init');
        if(typeof reconcileOrdersAfterSync==='function') reconcileOrdersAfterSync();
        if(typeof mergeAdminAuthFromRemote==='function'){
          mergeAdminAuthFromRemote(remote, {remoteWinsAuth:true});
        }
        if(typeof migrateAdmins==='function') migrateAdmins();
        if(typeof migrateSpaces==='function') migrateSpaces();
        if(typeof migrateDriverPins==='function') migrateDriverPins();
        persistLocalOnly();
        await pushServerState();
      }
    } else {
      await pushServerState();
    }
    syncStatus='ok';
    touchSyncServerOk();
  }catch(err){
    applySyncPushFailure(err, 'PB init');
  }
}
function scheduleAdminRerender(){
  if(typeof renderAdminDebounced==='function') renderAdminDebounced();
  else if(typeof renderAdmin==='function') renderAdmin();
}
/** Подтянуть новую эпоху с сервера без перезагрузки и без повторного PIN. */
async function pullRemoteUpdates(reason){
  const customerPull=reason==='customer-open'||reason==='customer-refresh';
  if(!armadaBackgroundRemoteSyncEnabled() && !customerPull) return false;
  if(!armadaBackgroundRemoteSyncEnabled() && reason==='poll') return false;
  if(autoSyncBusy) return false;
  if(!navigator.onLine) return false;
  if(Date.now()<pullBackoffUntil) return false;
  // Не мешаем активному вводу закрытия/создания — только если шаг idle или просмотр
  const busyStep=state.orderStep&&state.orderStep!=='idle'&&state.orderStep!=='postCloseWhere';
  if(busyStep && reason==='poll') return false;
  autoSyncBusy=true;
  try{
    const rec=await fetchServerState();
    if(!rec) return false;
    if(rec.unchanged){
      touchSyncServerOk();
      updateSyncHint();
      return false;
    }
    pbRecordId=rec.id;
    const remote=rec.payload||{};
    const remoteEpoch=Number(remote.dataEpoch)||0;
    const localEpoch=Number(state.dataEpoch)||0;
    if(remoteEpoch<=localEpoch){
      if(typeof mergeRemoteShiftClosures==='function'&&mergeRemoteShiftClosures(remote)){
        bumpDataEpoch('poll-remote-shift-close');
    writeLocalStorageSnapshot();
        if(currentAdmin&&typeof scheduleAdminRerender==='function') scheduleAdminRerender();
        touchSyncServerOk();
        updateSyncHint();
        console.info('auto-sync', reason, 'shift-close-only epoch', remoteEpoch);
        return true;
      }
      return false;
    }
    const localShifts=(state.shifts||[]).map(s=>structuredClone(s));
    const localOrders=(state.orders||[]).map(o=>structuredClone(o));
    const localInvoices=(state.invoices||[]).map(i=>structuredClone(i));
    const liveShift=state.shift && !state.shift.endedAt ? structuredClone(state.shift) : null;
    const inDriver=!!DRIVER && !!document.querySelector('#driver.show');
    const inAdmin=!!currentAdmin && !inDriver;
    const detailId=state.detailId;
    const keepStep=state.orderStep;
    const keepDraft=state.draft?structuredClone(state.draft):{};
    const keepMessages=(state.messages||[]).slice();
    const keepUiStep=state.step;
    const ordersOpen=!!document.querySelector('#orders-panel.show');
    const cabinetOpen=!!document.querySelector('#cabinet-panel.show');
    applyPayload(remote, {remoteSeq:true, remoteWinsAuth:true});
    mergeLocalShifts(localShifts);
    if(liveShift) mergeLocalShifts([liveShift]);
    mergeLocalOrders(localOrders);
    if(typeof mergeLocalInvoices==='function') mergeLocalInvoices(localInvoices);
    if(typeof mergeRemoteOrderAssignments==='function') mergeRemoteOrderAssignments(remote);
    const assignSnapBefore=typeof orderAssignmentRepairSnap==='function'?orderAssignmentRepairSnap():[];
    if(typeof reconcileOrdersAfterSync==='function') reconcileOrdersAfterSync();
    else if(typeof healOrphanOrdersIntoShifts==='function') healOrphanOrdersIntoShifts();
    migrateEtoFromMessages();
    writeLocalStorageSnapshot();
    if(inAdmin&&typeof pushRepairedAssignmentsIfNeeded==='function') await pushRepairedAssignmentsIfNeeded(assignSnapBefore);
    if(inDriver){
      // не поднимаем currentAdmin поверх режима водителя
      const open=findOpenShift();
      if(open){
        state.shift=open;
        // Чат: берём более полную историю (локальная или сменная)
        const shiftMsgs=(open.messages&&open.messages.length)?open.messages.slice():[];
        const richer=keepMessages.length>shiftMsgs.length?keepMessages:shiftMsgs;
        if(keepStep && keepStep!=='idle'){
          state.orderStep=keepStep;
          state.draft=keepDraft;
          state.step=keepUiStep||'done';
          state.messages=richer.length?richer:keepMessages;
        } else {
          state.messages=richer.length?richer:keepMessages;
          state.step=isEtoDone(open)?'done':(keepUiStep||'idle');
          restoreOrderWorkflow(open);
        }
        if(typeof driverNormalizeShiftMessages==='function'){
          state.messages=driverNormalizeShiftMessages(state.messages);
        }
        // обратно в смену — чтобы не отвалилось при следующем sync
        open.messages=state.messages.slice();
      }
      renderChat(); renderInput(); renderDriverBanner();
      if(ordersOpen) showOrders();
      if(cabinetOpen) showCabinet();
    } else if(inAdmin){
      if(typeof reconcileAdminSessionAfterSync==='function') reconcileAdminSessionAfterSync();
      else if(typeof restoreAdminSession==='function') restoreAdminSession();
      if(detailId && (state.orders||[]).some(o=>o.id===detailId)) openDetail(detailId);
      else if(document.querySelector('#admin-vehicle-card.show') && state._vehicleCardId) openVehicleCard(state._vehicleCardId);
      else if(document.querySelector('#admin-driver-card.show') && state._driverCardId) openDriverCard(state._driverCardId);
      else if(document.querySelector('#admin-catalogs-screen.show')) openCatalogs();
      else if(document.querySelector('#admin.show')) scheduleAdminRerender();
      if(typeof maybeNotifyAdminInboxUpdates==='function') maybeNotifyAdminInboxUpdates();
    } else if(typeof currentCustomer!=='undefined' && currentCustomer || document.querySelector('#customer-portal.show')){
      if(typeof restoreCustomerSession==='function') restoreCustomerSession();
      if(typeof renderCustomerPortal==='function') renderCustomerPortal();
      if(typeof maybeNotifyCustomerOrderUpdates==='function') maybeNotifyCustomerOrderUpdates();
    }
    syncStatus='ok';
    syncPullDegraded=false;
    pullFailCount=0;
    pullBackoffUntil=0;
    touchSyncServerOk();
    updateSyncHint();
    console.info('auto-sync', reason, 'epoch', remoteEpoch);
    return true;
  }catch(err){
    syncPullDegraded=true;
    pullFailCount=Math.min(pullFailCount+1, 12);
    pullBackoffUntil=Date.now()+Math.min(SYNC_BACKOFF_MAX_MS, 4000*pullFailCount);
    updateSyncHint();
    console.warn('auto-sync', reason, err);
    return false;
  }finally{
    autoSyncBusy=false;
  }
}
function stopAutoSync(){
  if(autoSyncTimer){ clearTimeout(autoSyncTimer); autoSyncTimer=null; }
}
function startAutoSync(){
  stopAutoSync();
  const tick=()=>{
    if(!document.hidden) pullRemoteUpdates('poll');
    autoSyncTimer=setTimeout(tick, autoSyncIntervalMs());
  };
  autoSyncTimer=setTimeout(tick, autoSyncIntervalMs());
}
if(typeof document!=='undefined'){
  document.addEventListener('visibilitychange', ()=>{
    if(document.hidden) stopAutoSync();
    else startAutoSync();
  });
  let syncStorageTimer=null;
  window.addEventListener('storage', (e)=>{
    if(e.key!==KEY || !e.newValue) return;
    clearTimeout(syncStorageTimer);
    syncStorageTimer=setTimeout(()=>{
      try{
        const parsed=JSON.parse(e.newValue);
        const remoteEpoch=Number(parsed.dataEpoch)||0;
        const localEpoch=Number(state.dataEpoch)||0;
        if(remoteEpoch<=localEpoch) return;
        unionDeletedOrderIds(parsed.deletedOrderIds||[]);
        const localShifts=(state.shifts||[]).map(s=>structuredClone(s));
        const localOrders=(state.orders||[]).map(o=>structuredClone(o));
        const localInvoices=(state.invoices||[]).map(i=>structuredClone(i));
        const liveShift=state.shift && !state.shift.endedAt ? structuredClone(state.shift) : null;
        applyPayload(parsed, {remoteSeq:true});
        if(typeof mergeLocalShifts==='function'){
          mergeLocalShifts(localShifts);
          if(liveShift) mergeLocalShifts([liveShift]);
        }
        if(typeof mergeLocalOrders==='function') mergeLocalOrders(localOrders);
        if(typeof mergeLocalInvoices==='function') mergeLocalInvoices(localInvoices);
        if(typeof healOrphanOrdersIntoShifts==='function') healOrphanOrdersIntoShifts();
        if(typeof migrateEtoFromMessages==='function') migrateEtoFromMessages();
    writeLocalStorageSnapshot();
        syncStatus='ok';
        if(typeof updateSyncHint==='function') updateSyncHint();
        if(typeof updateDriverNetHint==='function') updateDriverNetHint();
        if(currentAdmin) scheduleAdminRerender();
        if(typeof maybeNotifyAdminInboxUpdates==='function') maybeNotifyAdminInboxUpdates();
        if(DRIVER && typeof renderDriverBanner==='function') renderDriverBanner();
        if(typeof maybeNotifyCustomerOrderUpdates==='function') maybeNotifyCustomerOrderUpdates();
        if(typeof currentCustomer!=='undefined' && currentCustomer && typeof renderCustomerPortal==='function') renderCustomerPortal();
      }catch(err){ console.warn('storage-tab sync', err); }
    }, 120);
  });
}
const ARMADA_SYNC_BC='armada_sync_v1';
let armadaSyncChannel=null;
function armadaSyncBroadcast(kind){
  try{
    if(!armadaSyncChannel && typeof BroadcastChannel!=='undefined'){
      armadaSyncChannel=new BroadcastChannel(ARMADA_SYNC_BC);
      armadaSyncChannel.onmessage=(ev)=>{
        const d=ev&&ev.data;
        if(!d || d.type!=='state_touch') return;
        if(d.epoch && Number(d.epoch)<=Number(state.dataEpoch||0)) return;
        pullRemoteUpdates('broadcast');
      };
    }
    if(armadaSyncChannel) armadaSyncChannel.postMessage({type:'state_touch', epoch:state.dataEpoch, kind});
  }catch(_){}
}
(function wrapEntryRouteApply(){
  const raw=typeof window!=='undefined'?window.__armadaApplyEntryRoute:null;
  if(typeof raw!=='function') return;
  window.__armadaApplyEntryRoute=function(){
    try{
      if(typeof currentAdmin!=='undefined'&&currentAdmin&&typeof isAdminPinOk==='function'&&isAdminPinOk()) return true;
      if(document.querySelector('#admin.show')) return true;
    }catch(_){}
    return raw();
  };
})();
