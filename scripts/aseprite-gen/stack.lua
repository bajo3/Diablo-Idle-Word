-- Stacks exported layer sheets the way the runtime would, to prove they register.
local base = app.open(app.params["body"])
local W, H = base.width, base.height
local scale = tonumber(app.params["scale"] or "2")
local dst = Sprite(W*scale, H*scale, ColorMode.RGB)
local img = dst.cels[1].image
for y=0,H*scale-1 do for x=0,W*scale-1 do
  local c = (math.floor(x/8)+math.floor(y/8))%2==0 and 0x2C or 0x34
  img:putPixel(x,y,app.pixelColor.rgba(c,c,c,255))
end end
for _, key in ipairs({"body","armor","weapon"}) do
  local s = app.open(app.params[key])
  local im = Image(s.width, s.height, ColorMode.RGB)
  im:drawSprite(s, 1)
  for y=0,s.height-1 do for x=0,s.width-1 do
    local px = im:getPixel(x,y)
    if app.pixelColor.rgbaA(px) > 20 then
      for dy=0,scale-1 do for dx=0,scale-1 do img:putPixel(x*scale+dx, y*scale+dy, px) end end
    end
  end end
end
dst:saveCopyAs(app.params["out"])
print("stacked " .. W .. "x" .. H)
