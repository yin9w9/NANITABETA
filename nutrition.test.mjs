import {test} from 'node:test';import assert from 'node:assert/strict';import {servings,range,totals,dateKey} from './nutrition.js';
test('grams subtract carbohydrate protein before meat fat',()=>{assert.deepEqual(servings({mode:'grams',carbs:30,protein:25,fat:24,factor:3,veg:2,water:500}),{carbs:2,protein:3,fat:3,veg:2,water:500});});
test('medium and high fat factors',()=>{assert.equal(servings({mode:'grams',protein:14,fat:25,factor:5}).fat,3);assert.equal(servings({mode:'grams',protein:14,fat:25,factor:10}).fat,1);});
test('negative residuals clamp to zero',()=>{const s=servings({mode:'grams',carbs:150,protein:7,fat:0,factor:10});assert.equal(s.protein,0);assert.equal(s.fat,0);});
test('servings do not apply gram conversion',()=>{assert.deepEqual(servings({mode:'servings',carbs:6,protein:15,fat:2,veg:3,water:3000}),{carbs:6,protein:15,fat:2,veg:3,water:3000});});
test('week crosses year and has seven days',()=>{assert.deepEqual(range('2025-01-01','week','2026-10-30'),{from:'2024-12-30',to:'2025-01-05',days:7});});
test('leap month and quarter',()=>{assert.equal(range('2024-02-15','month','2026-10-30').days,29);assert.deepEqual(range('2026-11-05','quarter','2026-10-30'),{from:'2026-10-01',to:'2026-10-30',days:30});});
test('current period includes zero entry days up to today',()=>{assert.equal(range('2026-10-30','month','2026-10-30').days,30);assert.equal(totals([{mode:'servings',protein:15}]).protein/30,.5);});
test('date is device local calendar date',()=>{assert.equal(dateKey(new Date(2026,9,30,0,1)),'2026-10-30');});
