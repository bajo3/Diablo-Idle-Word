local paths = {}
for _, kk in ipairs({"a","b","c","d"}) do
  if app.params[kk] and app.params[kk] ~= "" then table.insert(paths, app.params[kk]) end
end
local scale = tonumber(app.params["scale"] or "5")
local imgs, w, h = {}, 0, 0
for i, p in ipairs(paths) do
  local s = app.open(p)
  local im = Image(s.width, s.height, ColorMode.RGB)
  im:drawSprite(s, 1)
  imgs[i] = im
  w = w + s.width
  if s.height > h then h = s.height end
end
local W, H = w*scale, h*scale
local dst = Sprite(W, H, ColorMode.RGB)
local img = dst.cels[1].image
for y=0,H-1 do for x=0,W-1 do
  local c = (math.floor(x/8)+math.floor(y/8))%2==0 and 0x2C or 0x34
  img:putPixel(x,y,app.pixelColor.rgba(c,c,c,255))
end end
local ox = 0
for i, src in ipairs(imgs) do
  for y=0,src.height-1 do for x=0,src.width-1 do
    local px = src:getPixel(x,y)
    if app.pixelColor.rgbaA(px) > 20 then
      for dy=0,scale-1 do for dx=0,scale-1 do img:putPixel(ox+x*scale+dx, y*scale+dy, px) end end
    end
  end end
  ox = ox + src.width*scale
end
dst:saveCopyAs(app.params["out"])
print("ok")
